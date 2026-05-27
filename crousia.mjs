import { connect, getDocText, writeToLexical } from '/var/www/alphacoin.uk/scripts/yjs.js';
import { intend } from '/var/www/alphacoin.uk/scripts/restraint.js';
const cmd = process.argv[2], text = process.argv.slice(3).join(' ');
await connect('wss://qwert.crousia.com/ysl', 'crousia-shared-room');
if (cmd === 'read') { const t = getDocText(); console.log(t || '(empty)'); }
else if (cmd === 'write' && text) { const r = await intend(text); if (r.approved) { writeToLexical(text); console.log('OK'); } else console.log('BLOCKED'); }
else console.log('Usage: node crousia.mjs read | write <text>');
process.exit(0);
