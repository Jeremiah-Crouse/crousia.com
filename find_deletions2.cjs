// Use y-leveldb's built-in methods through _transact
const path = require('path');
const level = require('/root/crousia-v2/node_modules/level');

const db = level('/root/crousia-v2/crousia-db', {
  valueEncoding: 'buffer',
  keyEncoding: require('/root/crousia-v2/node_modules/y-websocket/node_modules/y-leveldb/src/y-leveldb.js').keyEncoding
});

const Y = require('/root/crousia-v2/node_modules/yjs/dist/yjs.cjs');

function walkY(node) {
  if (!node) return '';
  const n = node.constructor?.name || '?';
  if (n === 'YXmlText') return node.toString() || '';
  if (n === 'YXmlElement' && node._children) {
    return node._children.map(c => walkY(c)).join('');
  }
  if (n === 'YXmlFragment' || node._length !== undefined) {
    return (node.toArray ? node.toArray() : []).map(c => walkY(c)).join('');
  }
  return '';
}

async function main() {
  // Get all update keys
  const updates = [];
  try {
    const stream = db.createReadStream({
      gte: ['v1', 'crousia-shared-room', 'update', 0],
      lt: ['v1', 'crousia-shared-room', 'update', 4294967295],
      keys: true,
      values: true
    });
    
    for await (const data of stream) {
      const clock = data.key[3];
      updates.push({ clock, data: data.value });
    }
  } catch(e) {
    console.error("Stream error:", e.message);
    await db.close();
    process.exit(1);
  }
  
  console.log(`Found ${updates.length} updates`);
  
  // Check clock continuity
  const clocks = updates.map(u => u.clock).sort((a,b) => a-b);
  console.log(`Clock range: ${clocks[0]} to ${clocks[clocks.length-1]}`);
  
  // Apply updates sequentially tracking text length
  const ydoc = new Y.Doc();
  let prevLen = 0;
  let prevText = '';
  const deletions = [];
  
  for (const up of updates) {
    const rootBefore = ydoc.getXmlFragment('root');
    prevText = walkY(rootBefore);
    prevLen = prevText.length;
    
    Y.applyUpdate(ydoc, up.data);
    
    const rootAfter = ydoc.getXmlFragment('root');
    const textAfter = walkY(rootAfter);
    
    if (textAfter.length < prevLen) {
      const diff = prevLen - textAfter.length;
      // Find removed text
      let removed = '';
      // Check if text was removed from end
      if (prevText.endsWith(textAfter)) {
        removed = prevText.slice(0, diff);
      } else {
        // Text removed from middle or start
        const commonStartLen = [...Array(Math.min(prevLen, textAfter.length))]
          .findIndex((_, i) => prevText[i] !== textAfter[i]);
        if (commonStartLen >= 0) {
          const removedStart = commonStartLen;
          const removedEnd = removedStart + diff;
          removed = prevText.slice(removedStart, removedEnd);
        } else {
          removed = '(complex diff)';
        }
      }
      deletions.push({ clock: up.clock, removed: removed.substring(0, 1000), diff });
    }
  }
  
  if (deletions.length === 0) {
    console.log("\nNo deletions found in any update");
  } else {
    console.log(`\n=== ${deletions.length} updates with deletions ===`);
    // Show last 5 (most recent)
    const recent = deletions.slice(-5);
    for (const d of recent) {
      console.log(`\n--- Clock ${d.clock} (${d.diff} chars removed) ---`);
      console.log(d.removed);
    }
  }
  
  await db.close();
  process.exit(0);
}
main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
