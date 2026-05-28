#!/bin/bash
# Starts opencode TUI in a persistent tmux session named "tui"
if tmux has-session -t tui 2>/dev/null; then
  exit 0
fi
tmux new-session -d -s tui
sleep 0.3
tmux send-keys -t tui '/home/ubuntu/crousia.com/opencode.sh' Enter
