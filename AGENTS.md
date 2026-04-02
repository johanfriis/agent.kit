# Agent Kit Development

## Installed locations

Pi loads extensions, skills, and prompts from two locations:

- **Global** (`~/.agents/`) — available in all projects
- **Local** (`.pi/` in the project root) — scoped to the current project

Local installs take precedence over global ones.

## Edit → Copy → Test workflow

Source of truth for extensions, skills, and prompts lives in this repo:

```
extensions/    Extension source code
skills/        Skill packages
prompts/       Prompt templates
```

**Never edit the installed copies directly.** Always edit here first, then
deploy for testing:

1. Make changes in the source directory (`extensions/`, `skills/`, `prompts/`)
2. Check if the item is already installed globally (`~/.agents/`)
3. **If installed globally** — copy it there:
   ```bash
   rsync -a --delete extensions/callout/ ~/.agents/extensions/callout/
   ```
4. **If not installed globally** — copy it to `.pi/` for local testing:
   ```bash
   rsync -a --delete extensions/callout/ .pi/extensions/callout/
   ```
5. Inform user they can reload

Never promote a locally-tested item to `~/.agents/` as part of this workflow.
Installing globally is a separate, deliberate decision.

## Building extensions

Before writing or modifying an extension, read the pi extensions documentation:

```bash
# Local copy (preferred)
find ~/.local/share/mise/installs/npm-mariozechner-pi-coding-agent -name "extensions.md" -path "*/docs/*"
```

Fallback URL: https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md
