// src/utils/collaboration.js
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

// ----- Shared state -----
let doc = null;
let provider = null;
let lastSyncTime = 0;

// Add a helper to get the color
const getUserColor = (username) => {
  if (username === "King Jeremiah") return "#FFD700"; // Gold
  if (username === "Queen Lauren") return "#800080";  // Purple
  return "#808080"; // Default Gray
};

// ----- Get or create Y.Doc -----
export const getSharedDoc = () => {
  if (!doc) {
    doc = new Y.Doc();
    console.log("📄 New Y.Doc created");
  }
  return doc;
};

// ----- Force reconnect and sync -----
export const forceReconnect = () => {
  if (provider) {
    console.log("🔄 Forcing reconnection...");
    provider.disconnect();
    provider.connect();
  }
};

// ----- Check if need to force sync on return -----
export const checkAndSync = () => {
  if (provider) {
    const now = Date.now();
    const timeSinceLastSync = now - lastSyncTime;
    
    if (timeSinceLastSync > 5000) {
      console.log("🔄 Detected return to page, forcing sync...");
      forceReconnect();
    }
  }
};

// ----- Create WebSocket Provider -----
export const getSharedProvider = ({ readonly = false, username = "guest" } = {}) => {
  if (!provider) {
    const doc = getSharedDoc();

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const hostname = window.location.hostname;
    const host = (hostname === 'localhost' || hostname === '127.0.0.1') ? 'localhost:1234' : 'qwert.crousia.com';
    provider = new WebsocketProvider(`${protocol}://${host}/ysl`, "crousia-shared-room", doc, {
      connect: false,
    });

    provider.on("status", (event) => console.log("🌟 Yjs Provider status:", event.status));
    provider.on("sync", (isSynced) => {
      console.log("🔗 Yjs Provider sync:", isSynced ? "✅ synced" : "❌ unsynced");
      if (isSynced) {
        lastSyncTime = Date.now();
      }
    });

    provider.awareness.setLocalStateField('user', {
      name: username,
      color: getUserColor(username), 
    });
  }
  return provider;
};

// ----- Cleanup on Unmount -----
export const cleanupSharedState = () => {
  if (provider) {
    provider.destroy();
    provider = null;
  }
  if (doc) {
    doc.destroy();
    doc = null;
  }
  lastSyncTime = 0;
  console.log("🧹 Shared state cleared for fresh remount");
};

// ----- Clear shared data -----
export const clearSharedData = async () => {
  if (doc) {
    doc.destroy();
    doc = null;
    provider = null;
    console.log("🧹 Y.Doc destroyed");
  }
  window.location.reload();
};

// ----- Check if user is admin -----
export const isAdmin = () => {
  const host = window.location.hostname;
  return host.startsWith("qwert.") || host === "localhost" || host === "127.0.0.1";
};