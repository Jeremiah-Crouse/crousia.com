#!/bin/bash
# crousia-keepalive.sh
# Keep serve.js, Yjs WebSocket, and Cloudflare Tunnel alive
# Works inside proot-distro Ubuntu

# Detect if running inside proot and source the proot entry if needed
if [ -f ~/bash ] && [ -z "$PROOT_LOADED" ]; then
    source ~/bash
fi

LOGS="/root/crousia-v2/logs"
mkdir -p "$LOGS"
CROUISA_DB="/root/crousia-v2/crousia-db"

echo "[$(date)] 🚀 Crousia Keep-Alive Script Starting..." | tee -a "$LOGS/keepalive.log"

# Paths to your scripts
SYNC_SERVER="/root/crousia-v2/server-sync.js"
WEB_SERVER="/root/crousia-v2/serve.js"
CLOUDFLARED="/usr/local/bin/cloudflared"  # adjust if different
TUNNEL_NAME="8f48ffd5-c69c-4fe2-911b-d492d965d028"

fix_leveldb_current() {
    if [ ! -d "$CROUISA_DB" ]; then return; fi
    
    local current_file="$CROUISA_DB/CURRENT"
    if [ ! -f "$current_file" ]; then return; fi
    
    local current_manifest=$(cat "$current_file" 2>/dev/null | head -1)
    if [ -z "$current_manifest" ] || [ ! -f "$CROUISA_DB/$current_manifest" ]; then
        echo "[$(date)] ⚠️  LevelDB CURRENT file corrupted, fixing..." | tee -a "$LOGS/keepalive.log"
        local latest_manifest=$(ls -1 "$CROUISA_DB"/MANIFEST-* 2>/dev/null | sort -V | tail -1 | xargs basename)
        if [ -n "$latest_manifest" ]; then
            echo "$latest_manifest" > "$current_file"
            echo "[$(date)] ✅ Fixed: CURRENT now points to $latest_manifest" | tee -a "$LOGS/keepalive.log"
        fi
    fi
}

while true; do
    TIMESTAMP="[$(date)]"

    # 1️⃣ server-sync.js (old - using custom server with broken persistence)
    # if ! pgrep -f "$SYNC_SERVER" > /dev/null; then
    #     echo "$TIMESTAMP Starting server-sync.js..." | tee -a "$LOGS/keepalive.log"
    #     nohup node "$SYNC_SERVER" >> "$LOGS/sync.log" 2>&1 &
    #     sleep 2
    # fi

    # 1️⃣ Yjs WebSocket server (using built-in y-websocket with working persistence)
    if ! pgrep -f "y-websocket/bin/server.js" > /dev/null; then
        fix_leveldb_current
        echo "$TIMESTAMP Starting y-websocket server..." | tee -a "$LOGS/keepalive.log"
        nohup bash -c 'HOST=0.0.0.0 PORT=1234 YPERSISTENCE=./crousia-db node /root/crousia-v2/node_modules/y-websocket/bin/server.js' >> "$LOGS/sync.log" 2>&1 &
        sleep 2
    fi

    # 2️⃣ serve.js (Node static site server)
    if ! pgrep -f "$WEB_SERVER" > /dev/null; then
        echo "$TIMESTAMP Starting serve.js..." | tee -a "$LOGS/keepalive.log"
        nohup node "$WEB_SERVER" >> "$LOGS/serve.log" 2>&1 &
        sleep 2
    fi

    # 3️⃣ Cloudflare Tunnel
    TUNNEL_PID=$(pgrep -f "$CLOUDFLARED tunnel run $TUNNEL_NAME")
    if [ -z "$TUNNEL_PID" ] || ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
        echo "$TIMESTAMP Starting Cloudflare Tunnel..." | tee -a "$LOGS/keepalive.log"
        nohup "$CLOUDFLARED" tunnel run "$TUNNEL_NAME" >> "$LOGS/cloudflared.log" 2>&1 &
        # Wait 15 seconds to let the tunnel establish
        sleep 15
    fi

    # Wait before the next check
    sleep 10
done
