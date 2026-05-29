#!/bin/bash
# Starts Adam TUI in a tmux window of the "tui" session
while ! tmux has-session -t tui 2>/dev/null; do
  sleep 0.5
done
if ! tmux list-windows -t tui | grep -q adam; then
  tmux new-window -t tui -n adam
fi
tmux send-keys -t tui:adam '/home/ubuntu/adam.sh' Enter
