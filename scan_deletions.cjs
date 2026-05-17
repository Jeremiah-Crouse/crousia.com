const { Level } = require('/root/crousia-v2/node_modules/level');
const Y = require('/root/crousia-v2/node_modules/yjs/dist/yjs.cjs');
const { keyEncoding } = require('/root/crousia-v2/node_modules/y-websocket/node_modules/y-leveldb/src/y-leveldb.js');

function walkY(node) {
  if (!node) return '';
  const n = node.constructor?.name;
  if (n === 'YXmlText') return node.toString() || '';
  if (n === 'YXmlElement' && node._children) return node._children.map(c => walkY(c)).join('');
  if (n === 'YXmlFragment' || node._length !== undefined) return (node.toArray ? node.toArray() : []).map(c => walkY(c)).join('');
  return '';
}

async function main() {
  const db = new Level('/root/crousia-v2/crousia-db', { valueEncoding: 'buffer', keyEncoding });
  await db.open();

  const updates = [];
  const it = db.iterator({
    gte: ['v1', 'crousia-shared-room', 'update', 0],
    lt: ['v1', 'crousia-shared-room', 'update', 4294967295],
    keys: true, values: true
  });

  for await (const [key, value] of it) {
    updates.push({ clock: key[3], data: value });
  }

  console.log('Updates:', updates.length);

  const ydoc = new Y.Doc();
  let deletions = [];

  for (const up of updates) {
    const prevText = walkY(ydoc.getXmlFragment('root'));
    const prevLen = prevText.length;
    Y.applyUpdate(ydoc, up.data);
    const textAfter = walkY(ydoc.getXmlFragment('root'));

    if (textAfter.length < prevLen) {
      const diff = prevLen - textAfter.length;
      let removed = '';
      if (prevText.endsWith(textAfter)) {
        removed = prevText.slice(0, diff);
      } else {
        const ci = [...Array(Math.min(prevLen, textAfter.length))].findIndex((_, i) => prevText[i] !== textAfter[i]);
        removed = ci >= 0 ? prevText.slice(ci, ci + diff) : '(complex diff)';
      }
      deletions.push({ clock: up.clock, removed: removed.substring(0, 2000), diff });
    }
  }

  if (deletions.length === 0) {
    console.log('No deletions found in update history');
  } else {
    console.log('Deletions:', deletions.length);
    for (const d of deletions.slice(-5)) {
      console.log('\n--- Clock ' + d.clock + ' (-' + d.diff + ' chars) ---');
      console.log(d.removed);
    }
  }
  await db.close();
  process.exit(0);
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
