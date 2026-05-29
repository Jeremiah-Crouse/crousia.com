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
    
    let current = editorRoot._start;
    let count = 0;
    while (current) {
      const typeNode = current.content?.type;
      if (typeNode) {
        // Let's look for a block that has embedded type children (not just ContentString)
        let hasEmbeddedChild = false;
        let child = typeNode._start;
        while (child) {
          if (child.content.type) {
            hasEmbeddedChild = true;
            break;
          }
          child = child.right;
        }
        
        if (hasEmbeddedChild || typeNode.toString().length > 0) {
          console.log(`\nBlock [${count}]: type=${typeNode.getAttribute("__type")}, toString()=${JSON.stringify(typeNode.toString().substring(0, 60))}`);
          console.log("  Attributes:", JSON.stringify(typeNode.getAttributes()));
          
          let c = typeNode._start;
          let cc = 0;
          while (c && cc < 10) {
            const ct = c.content;
            if (ct.type) {
              console.log(`    Child [${cc}]: Embedded Type constructor=${ct.type.constructor.name}, typeAttr=${ct.type.getAttribute("__type")}, toString=${JSON.stringify(ct.type.toString())}`);
              console.log(`      Attributes:`, JSON.stringify(ct.type.getAttributes()));
            } else if (ct.str) {
              console.log(`    Child [${cc}]: Text Content: ${JSON.stringify(ct.str)}`);
            }
            c = c.right;
            cc++;
          }
        }
        count++;
      }
      current = current.right;
    }
    
    process.exit(0);
  }, 2000);
});

setTimeout(() => {
  process.exit(1);
}, 10000);
