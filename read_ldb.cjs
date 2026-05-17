const leveldown = require('/root/crousia-v2/node_modules/leveldown');

// Try opening readonly
const db = leveldown('/root/crousia-v2/crousia-db');
db.open({ readOnly: true, errorIfExists: false }, (err) => {
  if (err) {
    console.error("Open error:", err.message);
    process.exit(1);
  }
  
  // List all keys
  const keys = [];
  const it = db.iterator();
  
  function next() {
    it.next((err, key, value) => {
      if (err) { console.error("Iter error:", err.message); it.end(() => process.exit(1)); return; }
      if (!key) {
        console.log(`Total keys: ${keys.length}`);
        // Show distribution of key types
        const types = {};
        for (const k of keys) {
          if (k.length === 9) { types['9-byte'] = (types['9-byte'] || 0) + 1; }
          else if (k.length > 9) { types[k[0].toString()] = (types[k[0].toString()] || 0) + 1; }
          else { types[`${k.length}-byte`] = (types[`${k.length}-byte`] || 0) + 1; }
        }
        console.log("Key type distribution:", JSON.stringify(types));
        it.end(() => db.close(() => process.exit(0)));
        return;
      }
      keys.push(key);
      next();
    });
  }
  next();
});
