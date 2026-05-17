const { LeveldbPersistence } = require('/root/crousia-v2/node_modules/y-websocket/node_modules/y-leveldb/src/y-leveldb.js');
const Y = require('/root/crousia-v2/node_modules/yjs/dist/yjs.cjs');

async function main() {
  const ldb = new LeveldbPersistence('/root/crousia-v2/crousia-db');
  console.log("LevelDB opened successfully");
  
  // Get all updates for the room
  const updates = [];
  try {
    // Get the YDoc at current state (replays all stored updates)
    const ydoc = await ldb.getYDoc('crousia-shared-room');
    
    // Now try to get individual updates
    // The updates are stored with keys like "crousia-shared-room\0<clock>"
    const allKeys = await getAllKeys(ldb, 'crousia-shared-room');
    console.log("All keys found:", allKeys.slice(0, 20));
    console.log("Total keys:", allKeys.length);
    
  } catch(e) {
    console.error("Error:", e.message, e.stack);
  }
  
  await ldb.destroy();
  process.exit(0);
}

function getAllKeys(ldb, prefix) {
  return new Promise((resolve, reject) => {
    const keys = [];
    // ldb has a store that wraps levelup
    // Let's try to access the underlying store
    if (ldb.store && ldb.store.db) {
      const it = ldb.store.db.iterator({
        gte: prefix,
        lte: prefix + '\xff\xff\xff\xff\xff\xff\xff\xff'
      });
      
      function next() {
        it.next((err, key, value) => {
          if (err) { reject(err); return; }
          if (!key) { it.end(() => resolve(keys)); return; }
          keys.push({ key: key.toString(), value: value });
          next();
        });
      }
      next();
    } else {
      resolve([]);
    }
  });
}

main();
