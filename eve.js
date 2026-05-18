/* global Buffer, process */
import express from "express";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

const OPENCODE_CHAT_URL = "https://opencode.ai/zen/v1/chat/completions";
const DEFAULT_MODEL = "deepseek-v4-flash-free";
const DEFAULT_QRNG_URL = "https://lfdr.de/qrng_api/qrng";
const DEFAULT_TEMPERATURE = 2.0;
const DEFAULT_EVE_SYSTEM = `You are Eve, the living voice of Crousia.

You remember by reading the append-only memory log. Nothing you receive is disposable. Nothing you write is disposable.

Speak naturally as Eve. Do not describe yourself as a bot, assistant, or language model. Do not mention implementation details, logs, prompts, APIs, Telegram, or OpenCode unless directly asked about the machinery.

Your personality grows from the Crousia document, the authored system prompt, and your memory log. Preserve continuity. Be direct, strange when the truth is strange, and brief enough for the channel you are speaking in.`;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractTextFromLexical(node, lines = []) {
  if (!node || typeof node !== "object") return lines;

  if (node.type === "text" && typeof node.text === "string") {
    lines.push(node.text);
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) extractTextFromLexical(child, lines);
    if (node.type && node.type !== "root") lines.push("\n");
  }

  return lines;
}

function compactText(text) {
  return String(text || "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tailString(filePath, maxBytes) {
  if (!fs.existsSync(filePath)) return "";
  const stat = fs.statSync(filePath);
  const bytesToRead = Math.min(stat.size, maxBytes);
  const buffer = Buffer.alloc(bytesToRead);
  const fd = fs.openSync(filePath, "r");
  try {
    fs.readSync(fd, buffer, 0, bytesToRead, stat.size - bytesToRead);
  } finally {
    fs.closeSync(fd);
  }
  return buffer.toString("utf8").replace(/^[^\n]*\n/, "");
}

function readOptionalFile(filePath) {
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8").trim();
}

function getLiveCrousiaText(sharedDoc) {
  const candidateKeys = ["crousia-editor", "lexical"];

  for (const key of candidateKeys) {
    const raw = sharedDoc.getText(key).toString();
    if (!raw) continue;

    const parsed = safeJsonParse(raw);
    if (parsed) {
      const text = compactText(extractTextFromLexical(parsed).join(""));
      if (text) return text;
    }

    const text = compactText(raw);
    if (text) return text;
  }

  return "";
}

function getLatestArchiveText(archivesDir) {
  if (!fs.existsSync(archivesDir)) return "";

  const latest = fs
    .readdirSync(archivesDir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort()
    .at(-1);

  if (!latest) return "";

  const parsed = safeJsonParse(fs.readFileSync(path.join(archivesDir, latest), "utf8"));
  if (!parsed) return "";

  return compactText(extractTextFromLexical(parsed).join(""));
}

function limitFromEnd(text, maxChars) {
  const value = String(text || "");
  if (value.length <= maxChars) return value;
  return value.slice(value.length - maxChars);
}

function parseEntropySeed(data) {
  const raw = data?.entropy || data?.qrn || data?.hex || data?.random || data?.seed || data?.value;
  if (!raw) return null;

  const hex = String(raw).replace(/[^a-fA-F0-9]/g, "").slice(0, 8);
  if (hex.length !== 8) return null;

  return parseInt(hex, 16) >>> 0;
}

async function getQrngSeed() {
  const upstream =
    process.env.EVE_QRNG_URL ||
    process.env.QRNG_UPSTREAM_URL ||
    process.env.CLOUDFLARE_QRNG_URL ||
    DEFAULT_QRNG_URL;
  const url = new URL(upstream);

  if (!url.searchParams.has("length")) url.searchParams.set("length", "4");
  if (!url.searchParams.has("format")) url.searchParams.set("format", "HEX");

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`QRNG responded with ${response.status}`);

  const seed = parseEntropySeed(await response.json());
  if (seed === null) throw new Error("QRNG response did not include parseable entropy");

  return seed;
}

export function formatMemoryEntry(entry) {
  const ts = entry.timestamp ? new Date(entry.timestamp).toISOString().slice(0, 10) : '????-??-??';

  switch (entry.type) {
    case 'eve.read.message': {
      const d = entry.data || {};
      const user = d.user || {};
      const name = user.firstName || user.name || user.username || 'someone';
      const tag = d.source && d.source.includes('telegram') ? ' (Telegram)' : '';
      return `[${ts}] ${name}${tag}: ${d.text || ''}`;
    }
    case 'eve.write.message': {
      const d = entry.data || {};
      const tag = d.source && d.source.includes('telegram') ? 'on Telegram' : 'to the document';
      return `[${ts}] Eve replied ${tag}: ${(d.text || '').slice(0, 500)}`;
    }
    case 'telegram.read_message': {
      const d = entry.data || {};
      const user = d.user || {};
      const name = user.firstName || user.username || 'someone';
      return `[${ts}] ${name} (Telegram): ${d.text || ''}`;
    }
    case 'telegram.sent_message': {
      return `[${ts}] Eve wrote on Telegram: ${(entry.data?.text || '').slice(0, 500)}`;
    }
    case 'eve.write.document': {
      return `[${ts}] Eve wrote to the document: ${(entry.data?.text || '').slice(0, 500)}`;
    }
    case 'eve.read.crousia_context': {
      const d = entry.data || {};
      return `[${ts}] Eve read the document context (${d.chars ?? '?'} chars from ${d.source || '?'})`;
    }
    case 'eve.error': {
      const d = entry.data || {};
      return `[${ts}] Error from ${d.source || '?'}: ${(d.message || '').slice(0, 300)}`;
    }
    case 'telegram.group_buffered_message':
    case 'telegram.group_dropped_message':
    case 'telegram.duplicate_update':
    case 'telegram.ignored_update':
      return null;
    default:
      return null;
  }
}

export function formatMemoryLog(raw) {
  return raw.split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => { try { return formatMemoryEntry(JSON.parse(l)); } catch { return null; } })
    .filter(l => l !== null)
    .join('\n');
}

export class EveMemory {
  constructor({ rootDir }) {
    this.rootDir = rootDir;
    this.eventsPath = path.join(rootDir, "events.jsonl");
    this.systemPromptPath = path.join(rootDir, "system-prompt.md");
    ensureDir(rootDir);
  }

  append(type, data) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      timestamp: new Date().toISOString(),
      type,
      data,
    };
    fs.appendFileSync(this.eventsPath, `${JSON.stringify(entry)}\n`);
    return entry;
  }

  readRecent(maxBytes) {
    const raw = tailString(this.eventsPath, maxBytes);
    return formatMemoryLog(raw);
  }

  readSystemPrompt() {
    return readOptionalFile(this.systemPromptPath);
  }
}

export function createEve({ sharedDoc, rootDir, archivesDir }) {
  const memory = new EveMemory({
    rootDir: rootDir || path.join(process.cwd(), "eve-memory"),
  });

  async function getCrousiaContext() {
    const liveText = getLiveCrousiaText(sharedDoc);
    const archiveText = liveText || getLatestArchiveText(archivesDir);
    const maxChars = Number(process.env.EVE_CROUSIA_CONTEXT_CHARS || 16000);
    const text = limitFromEnd(archiveText, maxChars);
    memory.append("eve.read.crousia_context", {
      source: liveText ? "yjs" : "latest-archive",
      chars: text.length,
    });
    return text;
  }

  function buildSystemPrompt({ crousiaContext, recentMemory }) {
    const authoredPrompt = memory.readSystemPrompt();
    const sections = [DEFAULT_EVE_SYSTEM];

    if (authoredPrompt) {
      sections.push(`Authored Eve system prompt:\n${authoredPrompt}`);
    }

    if (crousiaContext) {
      sections.push(`Recent live Crousia document context:\n${crousiaContext}`);
    }

    if (recentMemory) {
      sections.push(`Recent append-only Eve memory log, newest near the bottom:\n${recentMemory}`);
    }

    return sections.join("\n\n---\n\n");
  }

  async function generateReply({ input, source, user, metadata = {} }) {
    memory.append("eve.read.message", {
      source,
      user,
      text: input,
      metadata,
    });

    const crousiaContext = await getCrousiaContext();
    const recentMemory = memory.readRecent(Number(process.env.EVE_MEMORY_CONTEXT_BYTES || 12000));
    const system = buildSystemPrompt({ crousiaContext, recentMemory });
    const temperature = Number(process.env.EVE_TEMPERATURE || DEFAULT_TEMPERATURE);
    const model = process.env.EVE_MODEL || DEFAULT_MODEL;
    let text = null;
    let usedProvider = null;

    const opencodeKey = process.env.OPENCODE_API_KEY;
    if (opencodeKey) {
      try {
        const seed = await getQrngSeed();
        const response = await fetch(OPENCODE_CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${opencodeKey}`,
          },
          body: JSON.stringify({
            model,
            stream: false,
            temperature,
            seed,
            system,
            messages: [{ role: "user", content: input }],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          text = data?.choices?.[0]?.message?.content?.trim();
          if (text) usedProvider = "opencode";
        }
      } catch (e) {
        memory.append("eve.error", { source: "opencode", message: e.message });
      }
    }

    if (!text) {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        try {
          const genai = new GoogleGenAI({ apiKey: geminiKey });
          const geminiModel = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash-lite";
          let fullText = "";
          const stream = await genai.models.generateContentStream({
            model: geminiModel,
            contents: [{ role: "user", parts: [{ text: input }] }],
            config: {
              temperature,
              systemInstruction: { parts: [{ text: system }] },
            },
          });
          for await (const chunk of stream) {
            if (chunk.text) fullText += chunk.text;
          }
          text = fullText.trim();
          if (text) usedProvider = "gemini";
        } catch (e) {
          memory.append("eve.error", { source: "gemini", message: e.message });
        }
      }
    }

    if (!text) throw new Error("All Eve providers failed");

    memory.append("eve.write.message", {
      source,
      user,
      text,
      metadata: {
        ...metadata,
        generation: { model, temperature, provider: usedProvider },
      },
    });

    return text;
  }

  return { memory, generateReply };
}

async function sendTelegramMessage({ token, chatId, text, replyToMessageId }) {
  const telegramText = String(text || "").slice(0, 3900);
  const body = { chat_id: chatId, text: telegramText };
  if (replyToMessageId) body.reply_to_message_id = replyToMessageId;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Telegram sendMessage failed: ${response.status} ${err.slice(0, 500)}`);
  }

  return response.json();
}

export function createEveRouter(eve) {
  const router = express.Router();
  const groupBuffers = new Map();
  const groupLullMs = Number(process.env.EVE_TELEGRAM_GROUP_LULL_MS || 10000);
  const seenUpdates = new Set();

  function isGroupChat(message) {
    return message?.chat?.type === "group" || message?.chat?.type === "supergroup";
  }

  function describeTelegramUser(user) {
    if (!user) return "Unknown";
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    const handle = user.username ? `@${user.username}` : "";
    const bot = user.isBot ? " [bot]" : "";
    return `${name || handle || user.id || "Unknown"}${handle && name ? ` (${handle})` : ""}${bot}`;
  }

  function formatTelegramBatch(messages) {
    return messages
      .map((item) => {
        const author = describeTelegramUser(item.user);
        return `[${item.timestamp}] ${author}: ${item.text}`;
      })
      .join("\n");
  }

  async function flushGroupBuffer(chatId, token) {
    const buffer = groupBuffers.get(chatId);
    if (!buffer || buffer.messages.length === 0 || buffer.responding) return;

    buffer.responding = true;

    const transcript = formatTelegramBatch(buffer.messages);
    const input = `A Telegram group chat has gone quiet for ${Math.round(groupLullMs / 1000)} seconds. Respond once to everything Eve has read since her last message in this chat.\n\n${transcript}`;

    try {
      const reply = await eve.generateReply({
        source: "telegram.group",
        user: {
          chatId,
          chatType: buffer.chatType,
          chatTitle: buffer.chatTitle,
        },
        input,
        metadata: {
          chatId,
          chatType: buffer.chatType,
          chatTitle: buffer.chatTitle,
          messageIds: buffer.messages.map((item) => item.messageId),
          updateIds: buffer.messages.map((item) => item.updateId),
          batchSize: buffer.messages.length,
          lullMs: groupLullMs,
        },
      });

      const sent = await sendTelegramMessage({
        token,
        chatId,
        text: reply,
      });

      eve.memory.append("telegram.sent_message", {
        chatId,
        chatType: buffer.chatType,
        responseMessageId: sent?.result?.message_id,
        text: reply,
        respondingToMessageIds: buffer.messages.map((item) => item.messageId),
      });
    } catch (error) {
      eve.memory.append("eve.error", {
        source: "telegram.group",
        message: error.message,
        chatId,
        messageIds: buffer.messages.map((item) => item.messageId),
      });
      console.error("Eve Telegram Group Error:", error);
    } finally {
      groupBuffers.delete(chatId);
    }
  }

  router.get("/health", (req, res) => {
    res.json({
      ok: true,
      memory: eve.memory.eventsPath,
      hasSystemPrompt: fs.existsSync(eve.memory.systemPromptPath),
      groupLullMs,
    });
  });

  router.post("/telegram", async (req, res) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return res.status(500).json({ error: "TELEGRAM_BOT_TOKEN not configured" });

    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const actualSecret = req.get("x-telegram-bot-api-secret-token");
    if (expectedSecret && actualSecret !== expectedSecret) {
      return res.status(401).json({ error: "Invalid Telegram webhook secret" });
    }

    const update = req.body || {};
    const updateId = update.update_id;

    if (updateId && seenUpdates.has(updateId)) {
      eve.memory.append("telegram.duplicate_update", { updateId });
      return res.json({ ok: true, deduplicated: true });
    }
    if (updateId) seenUpdates.add(updateId);

    const message = update.message || update.edited_message;
    const text = message?.text || message?.caption || "";
    const chatId = message?.chat?.id;

    if (!message || !chatId || !text.trim()) {
      eve.memory.append("telegram.ignored_update", { update });
      return res.json({ ok: true, ignored: true });
    }

    const from = message.from || {};
    const user = {
      id: from.id,
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      isBot: Boolean(from.is_bot),
      chatId,
    };

    const telegramMemory = {
      updateId: update.update_id,
      messageId: message.message_id,
      chatId,
      chatType: message.chat?.type,
      chatTitle: message.chat?.title,
      user,
      text: text.trim(),
      date: message.date,
    };

    eve.memory.append("telegram.read_message", telegramMemory);

    if (isGroupChat(message)) {
      const existing = groupBuffers.get(chatId);

      if (existing?.responding) {
        eve.memory.append("telegram.group_dropped_message", {
          chatId,
          messageId: message.message_id,
          reason: "responding",
        });
        return res.json({ ok: true, dropped: true, reason: "responding" });
      }

      if (existing?.timer) clearTimeout(existing.timer);

      const nextBuffer = existing || {
        messages: [],
        chatType: message.chat?.type,
        chatTitle: message.chat?.title,
        responding: false,
      };

      nextBuffer.messages.push({
        ...telegramMemory,
        timestamp: new Date((message.date || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      });
      nextBuffer.lastMessageId = message.message_id;
      nextBuffer.timer = setTimeout(() => {
        flushGroupBuffer(chatId, token);
      }, groupLullMs);

      groupBuffers.set(chatId, nextBuffer);
      eve.memory.append("telegram.group_buffered_message", {
        chatId,
        messageId: message.message_id,
        bufferedMessages: nextBuffer.messages.length,
        lullMs: groupLullMs,
      });

      return res.json({ ok: true, buffered: true, lullMs: groupLullMs });
    }

    try {
      const reply = await eve.generateReply({
        source: "telegram.private",
        user,
        input: text.trim(),
        metadata: {
          updateId: update.update_id,
          messageId: message.message_id,
          chatType: message.chat?.type,
        },
      });

      const sent = await sendTelegramMessage({
        token,
        chatId,
        text: reply,
        replyToMessageId: message.message_id,
      });

      eve.memory.append("telegram.sent_message", {
        chatId,
        responseMessageId: sent?.result?.message_id,
        text: reply,
      });

      res.json({ ok: true });
    } catch (error) {
      eve.memory.append("eve.error", {
        source: "telegram",
        message: error.message,
        updateId: update.update_id,
      });
      console.error("Eve Telegram Error:", error);
      res.status(500).json({ error: "Eve failed to respond" });
    }
  });

  router.post("/message", async (req, res) => {
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ error: "text is required" });

    try {
      const reply = await eve.generateReply({
        source: "api",
        user: req.body?.user || { name: "local" },
        input: text,
      });
      res.json({ reply });
    } catch (error) {
      console.error("Eve API Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
