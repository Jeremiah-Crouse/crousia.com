// serve.js
import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import WebSocket from "ws";

const app = express();
const PORT = 5000;
const HOST = "0.0.0.0";
const ARCHIVES_DIR = 'archives';
const COMMENTS_DIR = 'comments';

if (!fs.existsSync(ARCHIVES_DIR)) fs.mkdirSync(ARCHIVES_DIR, { recursive: true });
if (!fs.existsSync(COMMENTS_DIR)) fs.mkdirSync(COMMENTS_DIR, { recursive: true });

// 1. The shared document, kept in sync by the provider
const sharedDoc = new Y.Doc();

// 2. Connect as a client to the binary sync server (port 1234)
// Use localhost to avoid cloudflare tunnel overhead
const provider = new WebsocketProvider(
  'ws://localhost:1234',  // Local connection instead of going through tunnel
  'crousia-shared-room',
  sharedDoc,
  { WebSocketPolyfill: WebSocket }
);

// Log sync status
provider.on('status', (event) => {
  console.log('📡 Provider status:', event.status);
});

provider.on('sync', (isSynced) => {
  console.log('🔄 Sync status:', isSynced ? 'synced' : 'not synced');
  if (isSynced) {
    console.log('📝 Doc content sample:', sharedDoc.getXmlFragment('content').toString().substring(0, 100));
  }
});

app.use(express.json());

// 3. API Routes
app.post('/api/archive-today', (req, res) => {
  const content = req.body?.content || '';
  
  // Use client's date if provided, otherwise use server's local timezone
  const today = req.body?.date || new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  const archivePath = path.join(ARCHIVES_DIR, `${today}.json`);
  
  fs.writeFileSync(archivePath, content);
  res.json({ success: true, length: content.length, date: today });
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
    if (!name || !text) {
      return res.status(400).json({ error: 'Name and comment text are required' });
    }

    const p = path.join(COMMENTS_DIR, `${date}.json`);
    let comments = [];
    if (fs.existsSync(p)) {
      comments = JSON.parse(fs.readFileSync(p, 'utf-8'));
    }

    const newComment = {
      name,
      email: email || '',
      text,
      timestamp: new Date().toISOString()
    };

    comments.push(newComment);
    fs.writeFileSync(p, JSON.stringify(comments, null, 2));
    res.json({ success: true, comment: newComment });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/archives', (req, res) => {
  try {
    const files = fs.readdirSync(ARCHIVES_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
      .sort()
      .reverse();
    res.json({ archives: files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/archive/:date', (req, res) => {
  try {
    const { date } = req.params;
    const p = path.join(ARCHIVES_DIR, `${date}.json`);
    if (fs.existsSync(p)) {
      res.json({ date, content: fs.readFileSync(p, 'utf-8') });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add this check to your API routes
app.get('/api/status', (req, res) => {
  const content = sharedDoc.getXmlFragment('content').toString();
  res.json({
    synced: provider.synced,
    hasContent: content.length > 0,
    contentPreview: content.substring(0, 100)
  });
});

// 4. Static Hosting
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "dist")));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "dist/index.html"));
});

const server = http.createServer(app);
server.listen(PORT, HOST, () => {
  console.log(`🚀 Federated Server running on http://${HOST}:${PORT}`);
});
