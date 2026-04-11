// serve.js
import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import WebSocket from "ws";
import multer from "multer";
import { Jimp } from "jimp";

const app = express();
const PORT = 5000;
const HOST = "0.0.0.0";
const ARCHIVES_DIR = 'archives';
const COMMENTS_DIR = 'comments';
const PUBLIC_NOTES_DIR = path.join('public', 'notes');
const DIST_NOTES_DIR = path.join('dist', 'notes');
const UPLOADS_DIR = 'uploads';

// Ensure all directories exist
[ARCHIVES_DIR, COMMENTS_DIR, PUBLIC_NOTES_DIR, DIST_NOTES_DIR, UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer for uploads
const upload = multer({ dest: UPLOADS_DIR });

// Image extraction logic (Node version of extract-black.py)
const COLOR_MAP = {
  white: { r: 255, g: 255, b: 255 },
  gold: { r: 255, g: 215, b: 0 },
  purple: { r: 160, g: 32, b: 240 },
};

async function processNoteImage(inputPath, outputPath, colorName = 'white') {
  const targetColor = COLOR_MAP[colorName] || COLOR_MAP.white;
  const image = await Jimp.read(inputPath);
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  
  let minX = width, maxX = 0, minY = height, maxY = 0;
  let foundAny = false;

  image.scan(0, 0, width, height, function(x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    const a = this.bitmap.data[idx + 3];

    // Threshold for "dark enough"
    if (r < 80 && g < 80 && b < 80 && a > 0) {
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
      this.bitmap.data[idx + 3] = 0; // Transparent
    }
  });

  if (!foundAny) return false;

  const padding = 10;
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(width, maxX + padding);
  const bottom = Math.min(height, maxY + padding);
  
  image.crop(left, top, right - left, bottom - top);
  // In Jimp v1, write() returns a promise
  await image.write(outputPath);
  return true;
}

// 1. The shared document, kept in sync by the provider
const sharedDoc = new Y.Doc();

// 2. Connect as a client to the binary sync server (port 1234)
const provider = new WebsocketProvider(
  'ws://localhost:1234',
  'crousia-shared-room',
  sharedDoc,
  { WebSocketPolyfill: WebSocket }
);

app.use(express.json());

// 3. API Routes
app.post('/api/upload-note', upload.single('image'), async (req, res) => {
  try {
    const { username } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    console.log(`Processing upload for ${username}: ${file.originalname}`);

    let color = 'white';
    if (username === 'King Jeremiah') color = 'gold';
    if (username === 'Queen Lauren') color = 'purple';

    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const timestamp = Date.now();
    const fileName = `note-${today}-${timestamp}.png`;
    
    const publicPath = path.join(PUBLIC_NOTES_DIR, fileName);
    const distPath = path.join(DIST_NOTES_DIR, fileName);

    // Process and save to public
    const success = await processNoteImage(file.path, publicPath, color);
    
    if (success) {
      // Copy to dist so it's immediately available
      fs.copyFileSync(publicPath, distPath);
      
      // Clean up temp upload
      fs.unlinkSync(file.path);
      
      console.log(`Successfully processed note: ${fileName}`);
      res.json({ success: true, url: `/notes/${fileName}` });
    } else {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: 'No note content detected in image' });
    }
  } catch (e) {
    console.error('Upload route failed:', e);
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

app.get('/api/archives', (req, res) => {
  try {
    const files = fs.readdirSync(ARCHIVES_DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')).sort().reverse();
    res.json({ archives: files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/archive/:date', (req, res) => {
  try {
    const { date } = req.params;
    const p = path.join(ARCHIVES_DIR, `${date}.json`);
    if (fs.existsSync(p)) res.json({ date, content: fs.readFileSync(p, 'utf-8') });
    else res.status(404).json({ error: 'Not found' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/status', (req, res) => {
  const content = sharedDoc.getXmlFragment('content').toString();
  res.json({ synced: provider.synced, hasContent: content.length > 0, contentPreview: content.substring(0, 100) });
});

// 4. Static Hosting
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "dist")));
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Global error handler to prevent HTML responses for API errors
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

const server = http.createServer(app);
server.listen(PORT, HOST, () => {
  console.log(`🚀 Federated Server running on http://${HOST}:${PORT}`);
});
