---
name: tmux
description: "Remote control tmux sessions for interactive CLIs (python, gdb, etc.) by sending keystrokes and scraping pane output."
license: Vibecoded
---

# tmux Skill

Use tmux as a programmable terminal multiplexer for interactive work. Works on Linux and macOS with stock tmux; uses a private socket with clean config to avoid interference from user tmux settings.

## Quickstart (isolated socket)

```bash
SOCKET_DIR=${TMPDIR:-/tmp}/agent-tmux-sockets   # well-known dir for all agent sockets
mkdir -p "$SOCKET_DIR"
SOCKET="$SOCKET_DIR/agent.sock"                  # keep agent sessions separate from your personal tmux
SESSION=agent-python                             # slug-like names; avoid spaces
tmux -f /dev/null -S "$SOCKET" new -d -s "$SESSION" -n shell

# Discover the actual target (base-index may vary)
TARGET=$(tmux -S "$SOCKET" list-panes -t "$SESSION" -F '#{session_name}:#{window_index}.#{pane_index}' | head -1)

tmux -S "$SOCKET" send-keys -t "$TARGET" -- 'python3 -q' Enter
tmux -S "$SOCKET" capture-pane -p -J -t "$TARGET" -S -200   # watch output
tmux -S "$SOCKET" kill-session -t "$SESSION"                 # clean up
```

After starting a session ALWAYS tell the user how to monitor the session by giving them a command to copy paste:

```
To monitor this session yourself:
  tmux -S <socket-path> attach -t <session-name>

Or to capture the output once:
  tmux -S <socket-path> capture-pane -p -J -t <target> -S -200
```

This must ALWAYS be printed right after a session was started and once again at the end of the tool loop. But the earlier you send it, the happier the user will be.

## Socket convention

- Agents MUST place tmux sockets under `AGENT_TMUX_SOCKET_DIR` (defaults to `${TMPDIR:-/tmp}/agent-tmux-sockets`) and use `tmux -S "$SOCKET"` so we can enumerate/clean them. Create the dir first: `mkdir -p "$SOCKET_DIR"`.
- Default socket path to use unless you must isolate further: `SOCKET="$SOCKET_DIR/agent.sock"`.

## Targeting panes — always discover dynamically

**Never hardcode `:0.0`.** The window and pane indices depend on tmux's `base-index` and `pane-base-index` settings (which default to 0 but are commonly set to 1). After creating a session, discover the target:

```bash
TARGET=$(tmux -S "$SOCKET" list-panes -t "$SESSION" -F '#{session_name}:#{window_index}.#{pane_index}' | head -1)
```

Use `$TARGET` for all subsequent `send-keys`, `capture-pane`, and `wait-for-text.sh` calls.

## Naming

- Keep names short and descriptive (e.g., `agent-py`, `agent-gdb`, `agent-build`).
- Use `-f /dev/null -S "$SOCKET"` consistently: `-f /dev/null` gives a clean config with predictable defaults, `-S` stays on the private socket path.
- Inspect: `tmux -S "$SOCKET" list-sessions`, `tmux -S "$SOCKET" list-panes -a`.

## Finding sessions

- List sessions on your active socket with metadata: `./scripts/find-sessions.sh -S "$SOCKET"`; add `-q partial-name` to filter.
- Scan all sockets under the shared directory: `./scripts/find-sessions.sh --all` (uses `AGENT_TMUX_SOCKET_DIR` or `${TMPDIR:-/tmp}/agent-tmux-sockets`).

## Sending input safely

- Prefer literal sends to avoid shell splitting: `tmux -S "$SOCKET" send-keys -t "$TARGET" -l -- "$cmd"`
- When composing inline commands, use single quotes or ANSI C quoting to avoid expansion: `tmux -S "$SOCKET" send-keys -t "$TARGET" -- $'python3 -m http.server 8000'`.
- To send control keys: `tmux -S "$SOCKET" send-keys -t "$TARGET" C-c`, `C-d`, `C-z`, `Escape`, etc.

## Watching output

- Capture recent history (joined lines to avoid wrapping artifacts): `tmux -S "$SOCKET" capture-pane -p -J -t "$TARGET" -S -200`.
- For continuous monitoring, poll with the helper script (below) instead of `tmux wait-for` (which does not watch pane output).
- You can also temporarily attach to observe: `tmux -S "$SOCKET" attach -t "$SESSION"`; detach with `Ctrl+b d`.
- When giving instructions to a user, **explicitly print a copy/paste monitor command** alongside the action — don't assume they remembered the command.

## Spawning Processes

Some special rules for processes:

- when asked to debug, use lldb by default
- when starting a python interactive shell, always set the `PYTHON_BASIC_REPL=1` environment variable. This is very important as the non-basic console interferes with your send-keys.

## Synchronizing / waiting for prompts

- Use timed polling to avoid races with interactive tools. Example: wait for a Python prompt before sending code:
  ```bash
  ./scripts/wait-for-text.sh -t "$TARGET" -p '^>>>' -T 15 -l 4000
  ```
- For long-running commands, poll for completion text (`"Type quit to exit"`, `"Program exited"`, etc.) before proceeding.

## Interactive tool recipes

- **Python REPL**: `tmux -S "$SOCKET" send-keys -t "$TARGET" -- 'PYTHON_BASIC_REPL=1 python3 -q' Enter`; wait for `^>>>`; send code with `-l`; interrupt with `C-c`.
- **gdb**: `tmux -S "$SOCKET" send-keys -t "$TARGET" -- 'gdb --quiet ./a.out' Enter`; disable paging `tmux -S "$SOCKET" send-keys -t "$TARGET" -- 'set pagination off' Enter`; break with `C-c`; issue `bt`, `info locals`, etc.; exit via `quit` then confirm `y`.
- **Other TTY apps** (ipdb, psql, mysql, node, bash): same pattern — start the program, poll for its prompt, then send literal text and Enter.

## Cleanup

- Kill a session when done: `tmux -S "$SOCKET" kill-session -t "$SESSION"`.
- Kill all sessions on a socket: `tmux -S "$SOCKET" list-sessions -F '#{session_name}' | xargs -r -n1 tmux -S "$SOCKET" kill-session -t`.
- Remove everything on the private socket: `tmux -S "$SOCKET" kill-server`.

## Helper: wait-for-text.sh

`./scripts/wait-for-text.sh` polls a pane for a regex (or fixed string) with a timeout. Works on Linux/macOS with bash + tmux + grep.

```bash
./scripts/wait-for-text.sh -t "$TARGET" -p 'pattern' [-F] [-T 20] [-i 0.5] [-l 2000]
```

- `-t`/`--target` pane target (required)
- `-p`/`--pattern` regex to match (required); add `-F` for fixed string
- `-T` timeout seconds (integer, default 15)
- `-i` poll interval seconds (default 0.5)
- `-l` history lines to search from the pane (integer, default 1000)
- Exits 0 on first match, 1 on timeout. On failure prints the last captured text to stderr to aid debugging.
