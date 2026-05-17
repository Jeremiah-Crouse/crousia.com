const { Level } = require('/root/crousia-v2/node_modules/level');
const Y = require('/root/crousia-v2/node_modules/yjs/dist/yjs.cjs');
const decoding = require('/root/crousia-v2/node_modules/lib0/decoding.js');

// Manual key encoding matching y-leveldb's keyEncoding
function encKey(arr) {
  const bufs = [];
  for (const v of arr) {
    if (typeof v === 'string') {
      bufs.push(Buffer.from([0]));
      bufs.push(Buffer.from(v, 'utf-8'));
    } else if (typeof v === 'number') {
      const b = Buffer.alloc(5);
      b[0] = 1;
      b.writeUInt32BE(v, 1);
      bufs.push(b);
    }
  }
  return Buffer.concat(bufs);
}

function decodeDeletes(update) {
  try {
    const decoder = decoding.createDecoder(new Uint8Array(update));
    const svLen = decoding.readVarUint(decoder);
    for (let i = 0; i < svLen; i++) { decoding.readVarUint(decoder); decoding.readVarUint(decoder); }
    const delLen = decoding.readVarUint(decoder);
    let count = 0;
    for (let i = 0; i < delLen; i++) {
      decoding.readVarUint(decoder);
      const n = decoding.readVarUint(decoder);
      for (let r = 0; r < n; r++) { const s = decoding.readVarUint(decoder); const e = decoding.readVarUint(decoder); count += (e - s); }
    }
    return count;
  } catch(e) { return -1; }
}

function walkY(node) {
  if (!node) return '';
  const n = node.constructor?.name;
  if (n === 'YXmlText') return node.toString() || '';
  if (n === 'YXmlElement' && node._children) return node._children.map(c => walkY(c)).join('');
  if (n === 'YXmlFragment' || node._length !== undefined) return (node.toArray ? node.toArray() : []).map(c => walkY(c)).join('');
  return '';
}

async function main() {
  const db = new Level('/root/crousia-v2/crousia-db', { valueEncoding: 'buffer' });
  await db.open();

  const updates = [];
  const it = db.iterator({
    gte: encKey(['v1', 'crousia-shared-room', 'update', 0]),
    lt: encKey(['v1', 'crousia-shared-room', 'update', 4294967295]),
    keys: false, values: true
  });
  for await (const value of it) {
    const dc = decodeDeletes(value);
    updates.push({ data: Buffer.from(value), delCount: dc });
  }
  console.log('Total updates:', updates.length);

  const withDels = updates.filter(u => u.delCount > 0);
  console.log('Updates with deletions:', withDels.length);
  for (const r of withDels.slice(-5)) {
    console.log('  clock at', updates.indexOf(r), 'delCount:', r.delCount);
  }

  const ydoc = new Y.Doc();
  for (const up of updates) {
    Y.applyUpdate(ydoc, up.data);
  }
  console.log('Final doc text length:', walkY(ydoc.getXmlFragment('root')).length);

  // Now check specific deletion updates by replaying
  for (const delUp of withDels.slice(-3)) {
    const tempY = new Y.Doc();
    const idx = updates.indexOf(delUp);
    for (let i = 0; i < idx; i++) Y.applyUpdate(tempY, updates[i].data);
    const before = walkY(tempY.getXmlFragment('root'));
    Y.applyUpdate(tempY, delUp.data);
    const after = walkY(tempY.getXmlFragment('root'));
    const diff = before.length - after.length;
    console.log('\nDeletion at update index', idx, '(' + delUp.delCount + ' ops, ' + diff + ' chars):');
    let removed = '';
    if (before.endsWith(after)) removed = before.slice(0, diff);
    else {
      const ci = [...Array(Math.min(before.length, after.length))].findIndex((_, i) => before[i] !== after[i]);
      removed = ci >= 0 ? before.slice(ci, ci + diff) : '(complex)';
    }
    console.log('"' + removed.substring(0, 500) + '"');
  }

  await db.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
