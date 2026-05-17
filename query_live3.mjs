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

function walkY(node, depth = 0) {
  if (!node) return '';
  const indent = '  '.repeat(depth);
  let result = '';
  
  const name = node.constructor?.name || '?';
  
  if (name === 'Text') {
    result += node.toString();
  } else if (name === 'XmlElement') {
    result += walkY(node._children, depth + 1);
  } else if (name === 'XmlFragment') {
    const arr = node.toArray();
    for (const child of arr) {
      result += walkY(child, depth + 1);
    }
  } else if (name === 'XmlHook') {
    result += walkY(node._children, depth + 1);
  } else if (name === 'XmlText') {
    result += node.toString();
  } else {
    // Map-like: try to extract text properties
    if (node._map) {
      for (const [, val] of node._map) {
        result += walkY(val, depth + 1);
      }
    }
    if (node._length !== undefined) {
      const arr = typeof node.toArray === 'function' ? node.toArray() : [];
      for (const child of arr) {
        result += walkY(child, depth + 1);
      }
    }
  }
  return result;
}

provider.on("sync", (synced) => {
  if (!synced || gotTypes) return;
  gotTypes = true;
  
  setTimeout(() => {
    const root = doc.getXmlFragment("root");
    console.log("=== root XmlFragment ===");
    console.log("Children count:", root.toArray().length);
    
    // Check first few children types
    const arr = root.toArray();
    for (let i = 0; i < Math.min(5, arr.length); i++) {
      const c = arr[i];
      console.log(`  [${i}] ${c.constructor?.name}, key=${c._key || 'none'}`);
    }
    if (arr.length > 5) console.log(`  ... (${arr.length - 5} more)`);
    
    // Extract all text from the XML tree
    const allText = walkY(root);
    console.log("\n=== Extracted text ===");
    console.log(`(${allText.length} chars)`);
    console.log(allText);
    
    // Also dump crousia-editor text length
    const rawText = doc.getText("crousia-editor").toString();
    console.log(`\n=== crousia-editor text (${rawText.length} chars) ===`);
    console.log(rawText);
    
    process.exit(0);
  }, 2000);
});

setTimeout(() => { console.log("TIMEOUT"); process.exit(1); }, 15000);
