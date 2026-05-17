import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import WebSocket from "ws";

const doc = new Y.Doc();
const provider = new WebsocketProvider(
  "ws://localhost:1234",
  "crousia-shared-room",
  doc,
  { WebSocketPolyfill: WebSocket }
);

provider.on("sync", (synced) => {
  if (!synced) return;
  setTimeout(() => {
    const xml = doc.getXmlFragment("lexical");
    const text = doc.getText("lexical");
    
    console.log("=== XML Fragment children ===");
    try {
      const json = xml.toJSON();
      console.log(JSON.stringify(json, null, 2));
    } catch(e) {
      console.log("XML toJSON failed:", e.message);
      console.log("Child count:", xml._length);
      for (let i = 0; i < xml._length; i++) {
        const child = xml._item(i);
        if (child) console.log(`  [${i}] type=${child.constructor?.name}, val=${child.toString()?.substring(0,200)}`);
      }
    }
    
    console.log("\n=== Text type content ===");
    console.log(text.toString());
    
    process.exit(0);
  }, 2000);
});

setTimeout(() => { console.log("TIMEOUT"); process.exit(1); }, 15000);
