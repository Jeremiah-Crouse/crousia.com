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
import multer from "multer";
import { Jimp } from "jimp";

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

  // Check if this note is referenced in any archive before deleting
  if (fs.existsSync(ARCHIVES_DIR)) {
    const archives = fs.readdirSync(ARCHIVES_DIR).filter(f => f.endsWith('.json'));
    for (const archive of archives) {
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
