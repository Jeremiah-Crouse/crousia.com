import { LeveldbPersistence } from '/root/crousia-v2/node_modules/y-websocket/node_modules/y-leveldb/dist/y-leveldb.mjs';
import * as Y from '/root/crousia-v2/node_modules/yjs/dist/yjs.mjs';

const ldb = new LeveldbPersistence('/root/crousia-v2/crousia-db');

try {
  const ydoc = await ldb.getYDoc('crousia-shared-room');
  
  const texts = [];
  const xmls = [];
  for (const [key, type] of ydoc.share.entries()) {
    const name = type.constructor.name;
    if (name === 'Text') texts.push(key);
    if (name === 'XmlFragment') xmls.push(key);
  }
  console.log("Text types:", texts);
  console.log("XmlFragment types:", xmls);
  
  for (const key of texts) {
    const t = ydoc.getText(key);
    const val = t.toString();
    console.log(`\n=== Text type "${key}" (${val.length} chars) ===`);
    console.log(val);
  }
  
  for (const key of xmls) {
    const frag = ydoc.getXmlFragment(key);
    console.log(`\n=== XmlFragment "${key}" (${frag._length} children) ===`);
    for (let i = 0; i < frag._length; i++) {
      const child = frag._item(i);
      console.log(`  [${i}] ${child?.constructor?.name}`);
    }
  }
  
  await ldb.destroy();
  process.exit(0);
} catch(e) {
  console.error("Error:", e.message);
  process.exit(1);
}
