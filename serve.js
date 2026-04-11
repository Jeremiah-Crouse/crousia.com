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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;
const HOST = "0.0.0.0";

// ... existing imports

const ARCHIVES_DIR = path.join(__dirname, 'archives');
const COMMENTS_DIR = path.join(__dirname, 'comments');
const PUBLIC_NOTES_DIR = path.join(__dirname, 'public', 'notes');
const DIST_NOTES_DIR = path.join(__dirname, 'dist', 'notes');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// ... existing directory creation and multer setup

async function cleanupUnusedNotes() {
  console.log("🧹 Starting orphan note cleanup...");
  try {
    const referencedNotes = new Set();

    // 1. Scan Archives
    if (fs.existsSync(ARCHIVES_DIR)) {
      const files = fs.readdirSync(ARCHIVES_DIR).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(ARCHIVES_DIR, file), 'utf-8');
        // Simple regex to find all note filenames in the JSON blob
        const matches = content.matchAll(/\/notes\/(note-[\w-]+\.png)/g);
        for (const match of matches) {
          referencedNotes.add(match[1]);
        }
      }
    }

    // 2. Scan Shared Doc (Today's Entry)
    // We stringify the entire Yjs doc structure to find references
    const docData = JSON.stringify(sharedDoc.toJSON());
    const liveMatches = docData.matchAll(/\/notes\/(note-[\w-]+\.png)/g);
    for (const match of liveMatches) {
      referencedNotes.add(match[1]);
    }

    console.log(`📌 Found ${referencedNotes.size} referenced notes.`);

    // 3. Clean Directories
    const cleanDir = (dirPath) => {
      if (!fs.existsSync(dirPath)) return;
      const files = fs.readdirSync(dirPath);
      let deletedCount = 0;

      for (const file of files) {
        if (!referencedNotes.has(file)) {
          const filePath = path.join(dirPath, file);
          const stats = fs.statSync(filePath);
          const now = Date.now();
          const ageMinutes = (now - stats.mtimeMs) / (1000 * 60);

          // Only delete if older than 5 minutes (grace period for new uploads)
          if (ageMinutes > 5) {
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        }
      }
      if (deletedCount > 0) console.log(`🗑️ Deleted ${deletedCount} orphans from ${dirPath}`);
    };

    cleanDir(PUBLIC_NOTES_DIR);
    cleanDir(DIST_NOTES_DIR);

  } catch (e) {
    console.error("❌ Cleanup failed:", e);
  }
}

// Run cleanup on start and every hour
setTimeout(cleanupUnusedNotes, 5000); // Wait 5s for Yjs sync
setInterval(cleanupUnusedNotes, 1000 * 60 * 60);

// ... existing processNoteImage function
  console.log(`🎨 Processing image: ${inputPath} -> ${colorName}`);
  const targetColor = COLOR_MAP[colorName] || COLOR_MAP.white;
  
  const image = await Jimp.read(inputPath);
  
  // Enhance image for better extraction
  image.greyscale(); // Convert to black and white
  image.normalize(); // Stretch levels to use full range
  image.contrast(0.6); // Push grays toward black or white (simple number for v1)
  
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  
  let minX = width, maxX = 0, minY = height, maxY = 0;
  let foundAny = false;

  // Jimp v1 scan
  image.scan(0, 0, width, height, function(x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const a = this.bitmap.data[idx + 3];

    // After greyscale and contrast, dark pixels will be very dark
    // Threshold 110 is a bit more generous than 80
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

  if (!foundAny) {
    console.log("⚠️ No note content detected.");
    return false;
  }

  const padding = 10;
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(width, maxX + padding);
  const bottom = Math.min(height, maxY + padding);
  
  // Jimp v1 crop uses an object
  image.crop({
    x: left,
    y: top,
    w: right - left,
    h: bottom - top
  });

  await image.write(outputPath);
  return true;
}

const sharedDoc = new Y.Doc();
const provider = new WebsocketProvider(
  'ws://localhost:1234',
  'crousia-shared-room',
  sharedDoc,
  { WebSocketPolyfill: WebSocket }
);

app.use(express.json());

// API Routes
app.post('/api/upload-note', upload.single('image'), async (req, res) => {
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
      console.log(`✅ Success: ${fileName}`);
      res.json({ success: true, url: `/notes/${fileName}` });
    } else {
      res.status(400).json({ error: 'No note content detected in image' });
    }
  } catch (e) {
    // Stringify the error properly to avoid [object Object] or inspection crashes
    const errorDetail = typeof e === 'object' ? JSON.stringify(e, null, 2) : String(e);
    console.error('💥 Upload error details:', errorDetail);
    res.status(500).json({ error: e.message || 'Internal Server Error', details: e });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
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

// Static Hosting
app.use(express.static(path.join(__dirname, "dist")));
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

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
