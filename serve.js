// serve.js
import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import WebSocket from "ws";

// ─── Persistent SSE client for Da She event stream ─────────────────────
const EVENT_URL = 'http://127.0.0.1:1111/event';
const RECONNECT_DELAY = 3000;
let sseConn = null;
let sseListeners = [];
let sseReconnectTimer = null;

function connectSSE() {
  if (sseConn) try { sseConn.destroy(); } catch {}
  console.log('[sse] connecting to', EVENT_URL);
  sseConn = http.get(EVENT_URL, (res) => {
    console.log('[sse] connected, status:', res.statusCode);
    let buf = '';
    res.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        try {
          const ev = JSON.parse(line.slice(5));
          if (ev.type === 'server.connected' || ev.type === 'server.heartbeat') continue;
          console.log('[sse] event:', ev.type);
          for (const cb of sseListeners) cb(ev);
        } catch {}
      }
    });
    res.on('end', () => {
      console.log('[sse] stream ended');
      scheduleReconnect();
    });
  });
  sseConn.on('error', (err) => {
    console.log('[sse] connection error:', err.message);
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (sseReconnectTimer) clearTimeout(sseReconnectTimer);
  sseReconnectTimer = setTimeout(connectSSE, RECONNECT_DELAY);
}

function addSSEListener(cb) {
  sseListeners.push(cb);
  return () => { sseListeners = sseListeners.filter(l => l !== cb); };
}

connectSSE();

// ─── Da She writes to root XmlText with Lexical paragraphs ──
let daSheRoot = null;

function makePara() {
  const p = new Y.XmlText();
  p.setAttribute('__type', 'paragraph');
  return p;
}

function daSheWrite(text, offset = null) {
  if (!daSheRoot || !text) return;
  let newOffset = offset;
  sharedDoc.transact(() => {
    let para = null;
    let relativeOffset = 0;

    if (offset !== null) {
      let cum = 0;
      let current = daSheRoot._start;
      while (current) {
        const typeNode = current.content?.type;
        if (typeNode instanceof Y.XmlText || typeNode instanceof Y.XmlElement) {
          const len = typeNode.length; // Yjs length includes text and embeds
          
          // Identify if the offset falls into this block or its starting boundary
          // We treat each block as [Text]\n. The +1 is the virtual newline.
          if (offset >= cum && (len === 0 ? offset === cum : offset <= cum + len)) {
            para = typeNode;
            relativeOffset = Math.max(0, Math.min(para.length, offset - cum));
            break;
          }
          cum += len + 1; // node length + virtual \n
        }
        current = current.right;
      }
    }

    // Fallback: find the last paragraph if offset is null or not found
    if (!para) {
      let current = daSheRoot._start;
      while (current) {
        const typeNode = current.content?.type;
        if (typeNode instanceof Y.XmlText || typeNode instanceof Y.XmlElement) {
          const type = typeNode.getAttribute('__type');
          if (type === 'paragraph' || type === 'heading') para = typeNode;
        }
        current = current.right;
      }
      if (para) relativeOffset = para.length;
    }

    if (!para) {
      para = makePara();
      daSheRoot.insertEmbed(daSheRoot._length, para);
      relativeOffset = 0;
    }

    para.insert(relativeOffset, text);
    if (newOffset !== null) newOffset += text.length;
  }, 'da-she');
  return newOffset;
}

// ─────────────────────────────────────────────────────────────────────────
import multer from "multer";
import { Jimp } from "jimp";
import Stripe from "stripe";
import archivesRouter from "./archives.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || "0.0.0.0";

const ARCHIVES_DIR = path.join(__dirname, 'archives');
const COMMENTS_DIR = path.join(__dirname, 'comments');
const PUBLIC_NOTES_DIR = path.join(__dirname, 'public', 'notes');
const DIST_NOTES_DIR = path.join(__dirname, 'dist', 'notes');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure all directories exist
[ARCHIVES_DIR, COMMENTS_DIR, PUBLIC_NOTES_DIR, DIST_NOTES_DIR, UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log(`📁 Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Multer setup using disk storage
const upload = multer({ dest: UPLOADS_DIR });

// Users file path
const USERS_FILE = path.join(__dirname, 'users.csv');

// Stripe setup
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Load users from CSV file
function loadUsers() {
  const users = {};
  try {
    if (fs.existsSync(USERS_FILE)) {
      const content = fs.readFileSync(USERS_FILE, 'utf-8');
      const lines = content.trim().split('\n');
      for (const line of lines) {
        const [name, password, active] = line.split(',');
        if (name && password) {
          users[name.trim()] = { 
            password: password.trim(), 
            active: active?.trim() === 'true' 
          };
        }
      }
      console.log(`👥 Loaded ${Object.keys(users).length} users`);
    }
  } catch (err) {
    console.log('Failed to load users:', err.message);
  }
  return users;
}

// Reload users on demand
function getUsers() {
  return loadUsers();
}

// Simple token store (in-memory for now)
const authTokens = new Map();

function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || "gemini-2.0-flash-lite";

const COLOR_MAP = {
  white: { r: 255, g: 255, b: 255 },
  gold: { r: 255, g: 215, b: 0 },
  purple: { r: 160, g: 32, b: 240 },
};

async function processNoteImage(inputPath, outputPath, colorName = 'white') {
  console.log(`🎨 Processing image: ${inputPath} -> ${colorName}`);
  const targetColor = COLOR_MAP[colorName] || COLOR_MAP.white;
  
  const image = await Jimp.read(inputPath);
  
  // Enhance image for better extraction
  image.greyscale(); // Convert to black and white
  image.normalize(); // Stretch levels to use full range
  image.contrast(0.6); // Push grays toward black or white
  
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  
  let minX = width, maxX = 0, minY = height, maxY = 0;
  let foundAny = false;

  image.scan(0, 0, width, height, function(x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const a = this.bitmap.data[idx + 3];

    if (r < 110 && a > 0) {
      this.bitmap.data[idx + 0] = targetColor.r;
      this.bitmap.data[idx + 1] = targetColor.g;
      this.bitmap.data[idx + 2] = targetColor.b;
      this.bitmap.data[idx + 3] = 255;
      
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      foundAny = true;
    } else {
      this.bitmap.data[idx + 3] = 0;
    }
  });

  if (!foundAny) return false;

  const padding = 10;
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(width, maxX + padding);
  const bottom = Math.min(height, maxY + padding);
  
  image.crop({ x: left, y: top, w: right - left, h: bottom - top });
  await image.write(outputPath);
  return true;
}

function getMimeTypeForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'image/png';
  }
}

async function getImageAltText(filePath) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return 'Uploaded note image';
  }

  try {
    const buffer = await fs.promises.readFile(filePath);
    const mimeType = getMimeTypeForFile(filePath);
    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;

    const response = await fetch(`${GEMINI_API_URL}/${encodeURIComponent(GEMINI_VISION_MODEL)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: buffer.toString('base64'),
                },
              },
              {
                text: 'Write concise HTML alt text for this image in one short sentence. Be specific, literal, and avoid phrases like "image of" or "picture of".',
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 80,
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`💥 Gemini alt-text error: ${response.status} ${body.slice(0, 300)}`);
      return 'Uploaded note image';
    }

    const result = await response.json();
    const parts = result?.candidates?.[0]?.content?.parts ?? [];
    const content = Array.isArray(parts)
      ? parts
          .map((part) => (part && typeof part.text === 'string' ? part.text : ''))
          .join(' ')
          .trim()
      : '';
    const altText = content;

    return altText || 'Uploaded note image';
  } catch (error) {
    console.error('💥 Failed to generate alt text:', error);
    return 'Uploaded note image';
  }
}

// Yjs Setup
const sharedDoc = new Y.Doc();
const provider = new WebsocketProvider(
  'ws://localhost:1234/ysl',
  'crousia-shared-room',
  sharedDoc,
  { WebSocketPolyfill: WebSocket }
);
provider.on('sync', (synced) => {
  daSheRoot = sharedDoc.get('root', Y.XmlText);
  if (synced) console.log('[da-she] root XmlText ready, paragraphs:', daSheRoot._length);
});

app.use(express.json());

// Authentication: check if name exists
app.post('/api/auth/check-name', (req, res) => {
  const { name } = req.body;
  console.log(`🔍 Checking name: ${name}`);
  
  if (!name) {
    return res.status(400).json({ error: 'Name required' });
  }
  
  const users = getUsers();
  if (users[name] && users[name].active) {
    return res.json({ valid: true });
  }
  
  console.log(`❌ Name not found or inactive: ${name}`);
  res.json({ valid: false, redirect: true });
});

// Authentication: validate password
app.post('/api/auth/login', (req, res) => {
  const { name, password } = req.body;
  console.log(`🔐 Login attempt: ${name}`);
  
  if (!name || !password) {
    return res.status(400).json({ error: 'Name and password required' });
  }
  
  const users = getUsers();
  if (users[name] && users[name].password === password && users[name].active) {
    const token = generateToken();
    authTokens.set(token, name);
    console.log(`✅ Login success: ${name}`);
    return res.json({ token, name, authorized: true });
  }
  
  console.log(`❌ Login failed: ${name}`);
  res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.body.token;
  if (token && authTokens.has(token)) {
    const name = authTokens.get(token);
    authTokens.delete(token);
    console.log(`👋 Logged out: ${name}`);
  }
  res.json({ ok: true });
});

// Pending signups storage (name -> { password, timestamp })
const pendingSignups = new Map();

// Test signup (skip payment)
app.post('/api/auth/signup-test', (req, res) => {
  const { name, password } = req.body;
  console.log(`🧪 Test signup: ${name}`);
  
  if (!name || !password) {
    return res.status(400).json({ error: 'Name and password required' });
  }
  
  const users = getUsers();
  if (users[name]) {
    return res.status(400).json({ error: 'Name already exists' });
  }
  
  try {
    const userLine = `\n${name},${password},true`;
    fs.appendFileSync(USERS_FILE, userLine, 'utf8');
    console.log(`✅ Test user added: ${name}`);
    res.json({ success: true, name });
  } catch (err) {
    console.error('Test signup failed:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Stripe checkout session
app.post('/api/auth/signup', async (req, res) => {
  const { name, password } = req.body;
  console.log(`💳 Signup request: ${name}`);
  
  if (!name || !password) {
    return res.status(400).json({ error: 'Name and password required' });
  }
  
  const users = getUsers();
  if (users[name]) {
    return res.status(400).json({ error: 'Name already exists' });
  }
  
  try {
    // Store pending signup
    pendingSignups.set(name, { password, timestamp: Date.now() });
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Crousia Editing Access',
            description: 'Monthly subscription for editing access'
          },
          unit_amount: 500, // $5.00
          recurring: {
            interval: 'month'
          }
        },
        quantity: 1
      }],
      mode: 'subscription',
      success_url: `${req.headers.origin}/?signup=success`,
      cancel_url: `${req.headers.origin}/?signup=cancel`,
      metadata: {
        name
      }
    });
    
    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: 'Payment setup failed' });
  }
});

// Stripe webhook
app.post('/api/auth/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    
    console.log(`📝 Stripe webhook: ${event.type}`);
    
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const customerId = session.customer;
      const customerEmail = session.customer_email;
      const metadata = session.metadata;
      
      // Check if this was a signup
      for (const [name, pending] of pendingSignups) {
        if (pending.password) {
          // Add to users CSV as active
          try {
            const userLine = `\n${name},${pending.password},true`;
            fs.appendFileSync(USERS_FILE, userLine, 'utf8');
            console.log(`✅ Added new user: ${name}`);
            pendingSignups.delete(name);
          } catch (err) {
            console.error('Failed to add user:', err);
          }
          break;
        }
      }
    }
    
    if (event.type === 'invoice.payment_succeeded') {
      console.log(`✅ Payment succeeded`);
    }
    
    if (event.type === 'invoice.payment_failed') {
      console.log(`❌ Payment failed`);
    }
    
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// Admin: reactivate user
app.post('/api/auth/reactivate', (req, res) => {
  const { name } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  // Simple admin check - could be more secure
  if (!name) {
    return res.status(400).json({ error: 'Name required' });
  }
  
  // Read and update CSV
  try {
    if (fs.existsSync(USERS_FILE)) {
      let content = fs.readFileSync(USERS_FILE, 'utf-8');
      const lines = content.trim().split('\n');
      const newLines = lines.map(line => {
        const [n, p, a] = line.split(',');
        if (n?.trim() === name) {
          return `${n.trim()},${p.trim()},true`;
        }
        return line;
      });
      fs.writeFileSync(USERS_FILE, newLines.join('\n'));
      console.log(`✅ Reactivated: ${name}`);
      return res.json({ success: true });
    }
  } catch (err) {
    console.error('Reactivate error:', err);
  }
  res.status(500).json({ error: 'Failed to reactivate' });
});

// Verify token utility
function isAuthenticated(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return { authorized: false };
  const name = authTokens.get(token);
  return { authorized: !!name, name };
}

// API Routes
app.post('/api/upload-note', (req, res, next) => {
  const auth = isAuthenticated(req);
  if (!auth.authorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}, upload.single('image'), async (req, res) => {
  console.log("📥 New upload request...");
  const tempPath = req.file?.path;
  
  try {
    const { username } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    console.log(`👤 User: ${username}, File: ${req.file.originalname}`);

    let color = 'white';
    if (username === 'King Jeremiah') color = 'gold';
    if (username === 'Queen Lauren') color = 'purple';

    const today = new Date().toLocaleDateString('en-CA');
    const fileName = `note-${today}-${Date.now()}.png`;
    const publicPath = path.join(PUBLIC_NOTES_DIR, fileName);
    const distPath = path.join(DIST_NOTES_DIR, fileName);

    const success = await processNoteImage(tempPath, publicPath, color);
    
    if (success) {
      if (!fs.existsSync(DIST_NOTES_DIR)) fs.mkdirSync(DIST_NOTES_DIR, { recursive: true });
      fs.copyFileSync(publicPath, distPath);
      const altText = await getImageAltText(publicPath);
      console.log(`✅ Success: ${fileName}`);
      res.json({ success: true, url: `/notes/${fileName}`, altText });
    } else {
      res.status(400).json({ error: 'No note content detected in image' });
    }
  } catch (e) {
    console.error('💥 Upload error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
});

app.delete('/api/delete-note', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  const fileName = path.basename(url);
  if (!fileName.startsWith('note-') || !fileName.endsWith('.png')) {
    return res.status(403).json({ error: 'Invalid file deletion request' });
  }

  // Check if this note is referenced in any archive (except TODAY's) before deleting
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  if (fs.existsSync(ARCHIVES_DIR)) {
    const archives = fs.readdirSync(ARCHIVES_DIR).filter(f => f.endsWith('.json'));
    for (const archive of archives) {
      // Skip today's archive - it will be overwritten anyway
      if (archive === `${today}.json`) continue;
      const content = fs.readFileSync(path.join(ARCHIVES_DIR, archive), 'utf-8');
      if (content.includes(fileName)) {
        console.log(`⛔ NOT deleting ${fileName} - still referenced in ${archive}`);
        return res.json({ success: false, reason: 'referenced' });
      }
    }
  }

  console.log(`🗑️ Deleting note: ${fileName}`);
  
  try {
    const publicPath = path.join(PUBLIC_NOTES_DIR, fileName);
    const distPath = path.join(DIST_NOTES_DIR, fileName);

    if (fs.existsSync(publicPath)) fs.unlinkSync(publicPath);
    if (fs.existsSync(distPath)) fs.unlinkSync(distPath);

    res.json({ success: true });
  } catch (e) {
    console.error('💥 Delete error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/archive-today', (req, res) => {
  const content = req.body?.content || '';
  const today = req.body?.date || new Date().toLocaleDateString('en-CA');
  const archivePath = path.join(ARCHIVES_DIR, `${today}.json`);
  fs.writeFileSync(archivePath, content);
  res.json({ success: true, length: content.length, date: today });
});

// Proxy for Quantum Randomness to bypass CORS
app.get('/api/proxy/qrng', async (req, res) => {
  const { length = 4, format = 'HEX' } = req.query;
  const upstream = process.env.QRNG_UPSTREAM_URL || process.env.CLOUDFLARE_QRNG_URL || 'https://lfdr.de/qrng_api/qrng';
  const url = new URL(upstream);
  url.searchParams.set('length', length);
  url.searchParams.set('format', format);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`QRNG responded with ${response.status}`);
    }

    const data = await response.json();
    if (data && data.qrn) {
      return res.json(data);
    }

    if (data && (data.hex || data.random || data.seed || data.value)) {
      return res.json(data);
    }

    throw new Error('QRNG response did not include entropy');
  } catch (error) {
    console.error('QRNG Proxy Error:', error.message);
    res.status(502).json({ error: 'Failed to fetch quantum randomness' });
  }
});

// Da She — aborts, posts to TUI, streams reasoning to browser, writes response to Yjs
app.post('/api/da-she/generate', express.json(), async (req, res) => {
  const { text, sessionID, cursorPos } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  const sid = sessionID || 'ses_3befb4677ffeSgQHiz4NWAbDBp';

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  let done = false;
  let userMessageID = null;
  let deltaCount = 0;
  let reasoningParts = new Set();
  let textParts = new Set();
  let deltaBuf = [];
  let currentOffset = (typeof cursorPos === 'number') ? cursorPos : null;

  const flushBuf = () => {
    deltaBuf = deltaBuf.filter(({ partID, delta }) => {
      if (partID && reasoningParts.has(partID)) {
        res.write(`data: ${JSON.stringify({ delta, type: 'reasoning' })}\n\n`);
        return false;
      }
      if (partID && textParts.has(partID)) {
        deltaCount++;
        currentOffset = daSheWrite(delta, currentOffset);
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        return false;
      }
      return true;
    });
  };

  const remove = addSSEListener((ev) => {
    try {
      // Ensure we only listen to events for THIS session
      if (ev.properties?.sessionID && ev.properties.sessionID !== sid) return;

      if (ev.type === 'message.updated') {
        const info = ev.properties?.info || ev.properties?.message;
        if (info?.role === 'user' && info?.id && !userMessageID)
          userMessageID = info.id;
      }

      if (ev.type === 'message.part.updated') {
        const p = ev.properties?.part;
        if (p?.messageID === userMessageID) return;
        if (p?.id && p.type === 'reasoning') {
          reasoningParts.add(p.id);
          flushBuf();
        } else if (p?.id && p.type === 'text') {
          textParts.add(p.id);
          flushBuf();
        }
      }

      if (ev.type === 'message.part.delta' && ev.properties?.delta) {
        if (ev.properties.messageID === userMessageID) return;
        const partID = ev.properties.partID;
        const delta = ev.properties.delta;

        if (partID && reasoningParts.has(partID)) {
          res.write(`data: ${JSON.stringify({ delta, type: 'reasoning' })}\n\n`);
        } else if (partID && textParts.has(partID)) {
          deltaCount++;
          currentOffset = daSheWrite(delta, currentOffset);
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        } else {
          // Unknown partID — buffer until part.updated tells us the type
          deltaBuf.push({ partID, delta });
          // Forward as reasoning tentatively for live button display
          res.write(`data: ${JSON.stringify({ delta, type: 'reasoning' })}\n\n`);
        }
      }

      if (ev.type === 'session.idle' && deltaCount > 0) {
        console.log('[da-she] session.idle, wrote', deltaCount, 'deltas');
        done = true;
      }
    } catch (e) {
      console.log('[da-she] listener error:', e.message);
    }
  });

  await fetch(`http://localhost:1111/session/${sid}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: { providerID: 'opencode-go', modelID: 'deepseek-v4-flash' },
      parts: [{ type: 'text', text }],
    }),
  }).catch(() => {});

  let waited = 0;
  while (!done && waited < 120) {
    await new Promise(r => setTimeout(r, 500));
    waited++;
  }

  res.write('data: [DONE]\n\n');
  res.end();
  remove();
});

app.get('/api/comments/:date', (req, res) => {
  try {
    const { date } = req.params;
    const p = path.join(COMMENTS_DIR, `${date}.json`);
    if (fs.existsSync(p)) {
      res.json({ date, comments: JSON.parse(fs.readFileSync(p, 'utf-8')) });
    } else {
      res.json({ date, comments: [] });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/comments/:date', (req, res) => {
  try {
    const { date } = req.params;
    const { name, email, text } = req.body;
    if (!name || !text) return res.status(400).json({ error: 'Name and comment text are required' });
    const p = path.join(COMMENTS_DIR, `${date}.json`);
    let comments = [];
    if (fs.existsSync(p)) comments = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const newComment = { name, email: email || '', text, timestamp: new Date().toISOString() };
    comments.push(newComment);
    fs.writeFileSync(p, JSON.stringify(comments, null, 2));
    res.json({ success: true, comment: newComment });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use('/api', archivesRouter);

// Static Hosting
app.use(express.static(path.join(__dirname, "dist")));
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Safe Error Handler
app.use((err, req, res, next) => {
  const errMsg = err ? (err.message || String(err)) : 'Unknown Error';
  console.error('🚨 Server Error:', errMsg);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: errMsg });
});

const server = http.createServer(app);
server.listen(PORT, HOST, () => {
  console.log(`🚀 Federated Server running on http://${HOST}:${PORT}`);
});
