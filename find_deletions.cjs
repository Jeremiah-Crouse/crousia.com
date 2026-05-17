const { LeveldbPersistence } = require('/root/crousia-v2/node_modules/y-websocket/node_modules/y-leveldb/src/y-leveldb.js');
const Y = require('/root/crousia-v2/node_modules/yjs/dist/yjs.cjs');

async function main() {
  const ldb = new LeveldbPersistence('/root/crousia-v2/crousia-db');
  
  // Get all individual updates by reading them sequentially
  const updates = [];
  let clock = 0;
  while (true) {
    try {
      const buf = await ldb._transact(async db => {
        const key = ['v1', 'crousia-shared-room', 'update', clock];
        const kenc = keyEncoding.encode(key);
        const val = await getRaw(db, kenc);
        return val;
      });
      if (!buf) break;
      updates.push({ clock, data: buf });
      clock++;
    } catch(e) {
      break;
    }
  }
  
  console.log(`Found ${updates.length} updates (clock 0 to ${clock-1})`);
  
  // Now apply updates one by one and track text changes
  // Create a doc and get initial state
  const ydoc = new Y.Doc();
  let prevText = '';
  const deletions = [];
  
  for (const up of updates) {
    const update = up.data;
    // Get text before
    const rootBefore = ydoc.getXmlFragment('root');
    const textBefore = walkY(rootBefore);
    
    // Apply update
    Y.applyUpdate(ydoc, update);
    
    // Get text after
    const rootAfter = ydoc.getXmlFragment('root');
    const textAfter = walkY(rootAfter);
    
    // Check if text was deleted
    if (textAfter.length < textBefore.length) {
      const diff = textBefore.length - textAfter.length;
      // Find what was removed - look at end of textBefore not in textAfter
      let removed = '';
      if (textBefore.endsWith(textAfter)) {
        removed = textBefore.slice(0, textBefore.length - textAfter.length);
      } else if (textAfter.endsWith(textBefore)) {
        // text was added, ignore
      } else {
        // Try to find the differing substring
        for (let i = 0; i < Math.min(textBefore.length, textAfter.length); i++) {
          if (textBefore[i] !== textAfter[i]) {
            removed = textBefore.slice(i, i + (textBefore.length - textAfter.length));
            break;
          }
        }
      }
      deletions.push({ clock: up.clock, removed: removed.substring(0, 500), diffLen: diff });
    }
  }
  
  if (deletions.length === 0) {
    console.log("\nNo deletions found in update history");
  } else {
    console.log(`\n=== Found ${deletions.length} updates with deletions ===`);
    // Show most recent first
    for (const d of deletions.reverse().slice(0, 5)) {
      console.log(`\n--- Clock ${d.clock} (-${d.diffLen} chars) ---`);
      console.log(d.removed);
    }
  }
  
  await ldb.destroy();
  process.exit(0);
}

// Helper: walk Yjs XML to extract text
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

// Helper: raw get from leveldb
const keyEncoding = require('/root/crousia-v2/node_modules/y-websocket/node_modules/y-leveldb/src/y-leveldb.js').keyEncoding;

function getRaw(db, key) {
  return new Promise((resolve, reject) => {
    db.get(key, { valueEncoding: 'buffer' }, (err, val) => {
      if (err) {
        if (err.notFound) resolve(null);
        else reject(err);
      } else resolve(val);
    });
  });
}

main().catch(e => { console.error(e.message, e.stack); process.exit(1); });
