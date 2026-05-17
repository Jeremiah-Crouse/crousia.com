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

function extractTextFromYjs(node, depth = 0) {
  if (!node) return '';
  let result = '';
  if (node.constructor?.name === 'Text') {
    result += node.toString();
  } else {
    if (node._item) {
      result += extractTextFromYjs(node._item, depth + 1);
    }
    if (node._length !== undefined) {
      for (let i = 0; i < node._length; i++) {
        const child = node._item(i);
        if (child) {
          const label = child._key ? `[${child._key}]` : '';
          result += extractTextFromYjs(child, depth + 1);
        }
      }
    }
    if (node._map) {
      for (const [key, val] of node._map) {
        result += extractTextFromYjs(val, depth + 1);
      }
    }
  }
  return result;
}

provider.on("sync", (synced) => {
  if (!synced || gotTypes) return;
  gotTypes = true;
  
  setTimeout(() => {
    // Dump the root XmlFragment
    try {
      const root = doc.getXmlFragment("root");
      console.log("=== root XmlFragment ===");
      console.log("length:", root._length);
      
      // Walk through all children
      let allText = '';
      for (let i = 0; i < root._length; i++) {
        const child = root._item(i);
        if (child) {
          const t = extractTextFromYjs(child);
          allText += t + '\n';
        }
      }
      console.log("Extracted text:", allText.substring(0, 5000));
    } catch(e) {
      console.log("root XmlFragment error:", e.message);
    }
    
    process.exit(0);
  }, 2000);
});

setTimeout(() => { console.log("TIMEOUT"); process.exit(1); }, 15000);
