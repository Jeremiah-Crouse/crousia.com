import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import WebSocket from "ws";

const doc = new Y.Doc();
let got = false;

const provider = new WebsocketProvider(
  "ws://localhost:1234/ysl",
  "crousia-shared-room",
  doc,
  { WebSocketPolyfill: WebSocket }
);

function walkY(node) {
  if (!node) return '';
  const n = node.constructor?.name || '?';
  if (n === 'YXmlText') return node.toString();
  if (n === 'YXmlElement' && node._children) {
    return node._children.map(c => walkY(c)).join('');
  }
  if (n === 'YXmlFragment' || node._length !== undefined) {
    return (node.toArray ? node.toArray() : []).map(c => walkY(c)).join('');
  }
  return '';
}

provider.on("sync", (synced) => {
  if (!synced || got) return;
  got = true;
  setTimeout(() => {
    const root = doc.getXmlFragment("root");
    const liveText = walkY(root);
    const lines = liveText.split('\n');
    console.log("LIVE:", liveText.length, "chars,", lines.length, "lines");
    console.log("Last 30 lines:");
    for (let i = Math.max(0, lines.length - 30); i < lines.length; i++) {
      console.log(`  ${lines[i].substring(0, 120)}`);
    }
    process.exit(0);
  }, 2000);
});
setTimeout(() => process.exit(1), 15000);
