#!/bin/bash
# Starts Eve TUI in a tmux window of the "tui" session
while ! tmux has-session -t tui 2>/dev/null; do
  sleep 0.5
done
if ! tmux list-windows -t tui | grep -q eve; then
  tmux new-window -t tui -n eve
fi
tmux send-keys -t tui:eve '/home/ubuntu/eve.sh' Enter
