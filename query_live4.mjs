import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import WebSocket from "ws";

const doc = new Y.Doc();
let gotTypes = false;

const provider = new WebsocketProvider(
  "ws://localhost:1234/ysl",
  "crousia-shared-room",
  doc,
  { WebSocketPolyfill: WebSocket }
);

function walkY(node) {
  if (!node) return '';
  const name = node.constructor?.name || '?';
  if (name === 'YXmlText') {
    return node.toString();
  }
  if (name === 'YXmlElement') {
    let s = '';
    if (node._children) {
      for (const c of node._children) {
        s += walkY(c);
      }
    }
    return s;
  }
  if (name === 'YXmlFragment' || node._length !== undefined) {
    return (node.toArray ? node.toArray() : []).map(c => walkY(c)).join('');
  }
  return '';
}

function collectAllChildren(node) {
  if (!node) return [];
  const name = node.constructor?.name || '?';
  if (name === 'YXmlText') {
    return [node.toString()];
  }
  if (name === 'YXmlElement') {
    let items = [`<${node._key || '?'}>`];
    if (node._children) {
      for (const c of node._children) {
        items = items.concat(collectAllChildren(c));
      }
    }
    items.push(`</${node._key || '?'}>`);
    return items;
  }
  if (name === 'YXmlFragment' || node._length !== undefined) {
    const arr = typeof node.toArray === 'function' ? node.toArray() : [];
    return arr.flatMap(c => collectAllChildren(c));
  }
  return [String(node)];
}

provider.on("sync", (synced) => {
  if (!synced || gotTypes) return;
  gotTypes = true;
  
  setTimeout(() => {
    const root = doc.getXmlFragment("root");
    const arr = root.toArray();
    
    // Show first 30 children types
    const counts = {};
    for (const c of arr) {
      const n = c.constructor?.name || '?';
      counts[n] = (counts[n] || 0) + 1;
    }
    console.log("Child types:", JSON.stringify(counts));
    
    // Extract all text
    const allText = walkY(root);
    console.log("\n=== Root text content ===");
    console.log(`(${allText.length} chars)`);
    // Print first/last 2000 chars
    console.log("--- FIRST 2000 ---");
    console.log(allText.substring(0, 2000));
    console.log("...");
    console.log("--- LAST 2000 ---");
    console.log(allText.substring(allText.length - 2000));
    
    process.exit(0);
  }, 2000);
});

setTimeout(() => { console.log("TIMEOUT"); process.exit(1); }, 15000);
