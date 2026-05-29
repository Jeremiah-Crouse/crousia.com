import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import WebSocket from "ws";

const doc = new Y.Doc();
const provider = new WebsocketProvider(
  "ws://localhost:1234/ysl",
  "crousia-shared-room",
  doc,
  { WebSocketPolyfill: WebSocket }
);

provider.on("sync", (synced) => {
  if (!synced) return;
  setTimeout(() => {
    const editorRoot = doc.get("crousia-editor", Y.XmlText);
    console.log("=== crousia-editor Y.XmlText ===");
    console.log("Length:", editorRoot.length);
    
    let current = editorRoot._start;
    let count = 0;
    while (current && count < 5) {
      const typeNode = current.content?.type;
      if (typeNode) {
        console.log(`\nBlock [${count}]:`);
        console.log("  Constructor:", typeNode.constructor.name);
        console.log("  Type attribute:", typeNode.getAttribute("__type"));
        console.log("  toString():", JSON.stringify(typeNode.toString()));
        
        // Print inner details of the block
        console.log("  Attributes:", JSON.stringify(typeNode.getAttributes()));
        
        // Let's inspect children of this node
        let child = typeNode._start;
        let childCount = 0;
        while (child) {
          const ct = child.content;
          console.log(`    Child [${childCount}]: content constructor=${ct.constructor.name}`);
          if (ct.type) {
            console.log(`      Embedded Type: constructor=${ct.type.constructor.name}, typeAttr=${ct.type.getAttribute("__type")}, toString=${JSON.stringify(ct.type.toString())}`);
          } else if (ct.str) {
            console.log(`      Text Content: ${JSON.stringify(ct.str)}`);
          } else {
            console.log(`      Content details:`, ct);
          }
          child = child.right;
          childCount++;
        }
        count++;
      }
      current = current.right;
    }
    
    process.exit(0);
  }, 2000);
});

setTimeout(() => {
  console.log("Timeout");
  process.exit(1);
}, 10000);
