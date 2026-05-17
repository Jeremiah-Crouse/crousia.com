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

provider.on("sync", (synced) => {
  if (!synced || gotTypes) return;
  gotTypes = true;
  
  setTimeout(() => {
    console.log("=== Shared types ===");
    for (const [key] of doc.share.entries()) {
      console.log("  key:", key);
    }
    
    const textType = doc.getText("crousia-editor");
    if (textType) {
      const val = textType.toString();
      console.log(`\n=== crousia-editor (${val.length} chars) ===`);
      try {
        const parsed = JSON.parse(val);
        function extract(node) {
          const texts = [];
          if (node && typeof node === 'object') {
            if (node.type === 'text' && node.text) texts.push(node.text);
            for (const v of Object.values(node)) {
              if (Array.isArray(v)) texts.push(...v.flatMap(extract));
              else if (v && typeof v === 'object') texts.push(...extract(v));
            }
          }
          return texts;
        }
        const allText = extract(parsed).join('\n');
        console.log(allText);
      } catch(e) {
        console.log("(not JSON):", val);
      }
    }
    
    // Also try XmlFragment
    try {
      const xml = doc.getXmlFragment("lexical");
      console.log(`\n=== XmlFragment lexical (${xml._length} children) ===`);
      for (let i = 0; i < xml._length; i++) {
        const child = xml._item(i);
        if (child) console.log(`  [${i}] ${child.constructor?.name}`);
      }
    } catch(e) {
      console.log("No xml fragment 'lexical':", e.message);
    }
    
    process.exit(0);
  }, 2000);
});

setTimeout(() => { console.log("TIMEOUT"); process.exit(1); }, 15000);
