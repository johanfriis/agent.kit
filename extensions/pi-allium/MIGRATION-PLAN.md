# pi.allium — Migration & Build Plan

## Overview

Move pi-allium out of agent.kit into its own repo (`johanfriis/pi.allium`),
soft-fork all of upstream allium's pi-relevant pieces into it, and ship as
a single `pi install` that gives you everything: extension, skills, and
agents.

## Architecture

### What gets installed

```
pi install git:github.com/johanfriis/pi.allium
```

Installs via pi's package system:
- **Extension**: pi-allium (change management, validation hook, workshop,
  /tend, /weed commands)
- **Skills**: allium (syntax + language reference), elicit, distill, propagate
- **Agents** (via library dependency): tend, weed

### Library catalog shape

```yaml
# library.yaml

extensions:
  - name: allium
    description: Allium spec-driven development — change management, validation, workshop, tend/weed orchestration
    source: git:github.com/johanfriis/pi.allium
    requires: [agent:tend, agent:weed, extension:pi-subagents]

agents:
  - name: tend
    description: Tend the Allium garden — modify .allium specs via subagent
    source: https://github.com/johanfriis/pi.allium/blob/main/agents/tend.md

  - name: weed
    description: Weed the Allium garden — check spec-code alignment via subagent
    source: https://github.com/johanfriis/pi.allium/blob/main/agents/weed.md
```

The old individual skill entries for allium, elicit, distill, propagate,
tend (as skill), and weed (as skill) get removed or marked as superseded
by the `allium` extension.

## Repo Structure

```
johanfriis/pi.allium/
├── package.json              # pi manifest
├── Makefile                  # sync-upstream, diff-upstream, update-upstream
├── UPSTREAM.md               # Documents what was forked, from where, at what commit
├── scripts/
│   └── update-from-upstream.md  # Headless agent prompt for merging upstream changes
│
├── extensions/
│   └── pi-allium/
│       └── index.ts          # Extension code (updated from agent.kit version)
│
├── skills/
│   ├── allium/
│   │   ├── SKILL.md          # Adapted from upstream allium SKILL.md
│   │   └── references/
│   │       ├── language-reference.md
│   │       ├── migration-v1-to-v2.md
│   │       ├── migration-v2-to-v3.md
│   │       ├── patterns.md
│   │       └── test-generation.md
│   ├── elicit/
│   │   ├── SKILL.md          # Adapted from upstream elicit skill
│   │   └── references/
│   │       └── library-spec-signals.md
│   ├── distill/
│   │   └── SKILL.md          # Adapted from upstream distill skill
│   └── propagate/
│       └── SKILL.md          # Adapted from upstream propagate skill
│
├── agents/                   # NOT auto-discovered by pi packages
│   ├── tend.md               # pi-subagent agent format, adapted from upstream
│   └── weed.md               # pi-subagent agent format, adapted from upstream
│
└── specs/                    # Dogfooding — allium specs for the extension itself
    ├── pi-allium.allium
    └── changes/
        └── ...
```

### package.json

```json
{
  "name": "pi-allium",
  "version": "0.1.0",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"]
  }
}
```

Note: `agents/` is NOT listed in the pi manifest. Agents are installed
separately via library `use` (they go to `~/.pi/agent/agents/`). The
library's `requires` field on the extension entry triggers this
automatically.

## Adaptations from Upstream

### Skills

The upstream allium skills are mostly tool-agnostic instructions. The
adaptations needed:

1. **Frontmatter**: Upstream uses Claude's format. Replace with pi skill
   frontmatter (`name`, `description`, `auto_trigger` where applicable).

2. **Paths**: Upstream references like
   `./references/language-reference.md` work as-is since we preserve
   the directory structure. But any hardcoded absolute paths (like the
   current `/home/box/.agents/skills/allium/references/...`) need to
   become relative.

3. **Tool references**: Upstream mentions `Glob` (Claude tool). Replace
   with pi equivalents (`find`, `grep`, `ls`).

4. **CLI references**: References to `allium check`, `allium plan`,
   `allium model` stay as-is — they're external CLI tools, not
   Claude-specific.

### Agents (tend, weed)

These need the most adaptation — converting from Claude Code agent
format to pi-subagent agent format:

**Upstream (Claude Code agent):**
```markdown
# Tend

You tend the Allium garden...

## Startup
1. Read ./references/language-reference.md...
```

**Adapted (pi-subagent agent):**
```yaml
---
name: tend
description: Tend the Allium garden — modify .allium specs
tools: read, edit, write, grep, find, ls
skill: allium
extensions:
---

# Tend

You tend the Allium garden...

## Startup
1. The allium skill is already loaded (provides language reference
   and syntax rules). Read it if you need to check syntax details.
2. Read the relevant .allium files...
```

Key changes:
- Add pi-subagent frontmatter (name, description, tools, model, skill)
- `skill: allium` injects the allium SKILL.md automatically — no need
  for the agent to manually read the language reference
- `extensions:` (empty) means no extensions load — lean context
- `tools:` lists only what tend/weed need (no bash for tend, etc.)
- Remove Claude-specific startup steps (the skill injection replaces
  manual file reading)
- Keep all methodology content unchanged

**tend agent tools**: `read, edit, write, grep, find, ls`
(needs edit/write for modifying .allium files)

**weed agent tools**: `read, grep, find, ls`
(read-only — it reports divergences, doesn't fix them by default)

## Extension Changes (index.ts)

### Remove
- `allium_tend` tool (replaced by subagent delegation)
- `allium_weed` tool (replaced by subagent delegation)
- `readSkillFile()` helper (no longer needed)
- In-session methodology injection in /tend and /weed commands

### Update
- `/tend` command → delegates to subagent tool:
  ```typescript
  pi.registerCommand("tend", {
    handler: async (args, ctx) => {
      const specFiles = findAlliumFiles(ctx.cwd);
      const changeContext = getActiveChangeContext(ctx.cwd);

      let task = args || "Read the spec files and ask what changes to make.";
      task += `\n\nSpec files: ${specFiles.join(", ")}`;
      if (changeContext) task += `\n\nActive change context:\n${changeContext}`;

      pi.sendUserMessage(
        `Use the subagent tool to run the "tend" agent with this task:\n\n${task}`
      );
    },
  });
  ```
- `/weed` command → same pattern, delegates to weed agent
- `/workshop` command → keep as-is (workshop is an in-session activity,
  not a subagent — you want the conversation context)

### Keep unchanged
- `allium_change` tool (scaffold/list/archive)
- Validation hook (`tool_result` listener for .allium files)
- `/changes` command
- `/workshop` command
- Helper functions (findAlliumFiles, findCodeFiles, etc.)
- Workshop methodology constant

### Add
- `promptGuidelines` for the extension telling the model about
  available agents: "Use the subagent tool with the 'tend' agent
  for spec modifications and the 'weed' agent for alignment checks."

## Library Catalog Updates

### Update default_dirs

```yaml
default_dirs:
  agents:
    - default: .pi/agents/
    - global: ~/.pi/agent/agents/
```

This aligns with where pi-subagents actually discovers agents.

### Remove superseded entries

Remove from `skills:`:
- `allium` (now bundled in the extension package)
- `elicit` (now bundled)
- `distill` (now bundled)
- `propagate` (now bundled)
- `tend` (now an agent, not a skill)
- `weed` (now an agent, not a skill)

### Add new entries

Add to `agents:` (currently empty):
- `tend`
- `weed`

Replace `pi-allium` in `extensions:` with `allium`.

## Upstream Sync Mechanism

### UPSTREAM.md

```markdown
# Upstream Sources

This package contains adapted versions of files from the
[Allium](https://github.com/juxt/allium) project.

## Pinned Commit
upstream: juxt/allium @ <commit-sha>
synced: YYYY-MM-DD

## File Mapping

| Local                              | Upstream                                    |
|------------------------------------|---------------------------------------------|
| skills/allium/SKILL.md             | SKILL.md                                    |
| skills/allium/references/*         | references/*                                |
| skills/elicit/SKILL.md             | skills/elicit/SKILL.md                      |
| skills/elicit/references/*         | skills/elicit/references/*                  |
| skills/distill/SKILL.md            | skills/distill/SKILL.md                     |
| skills/propagate/SKILL.md          | skills/propagate/SKILL.md                   |
| agents/tend.md                     | .claude/agents/tend.md                      |
| agents/weed.md                     | .claude/agents/weed.md                      |

## Adaptations Applied
- Frontmatter converted to pi format (skills) / pi-subagent format (agents)
- Absolute paths made relative
- Claude-specific tool references (Glob) replaced with pi equivalents
- Agent startup sections updated for skill injection
- language-reference.md path references made relative to skill directory
```

### Makefile

```makefile
UPSTREAM_REPO = https://github.com/juxt/allium.git
UPSTREAM_DIR = .upstream

.PHONY: sync-upstream diff-upstream update-upstream clean-upstream

# Clone upstream into .upstream/ for inspection
sync-upstream:
	@rm -rf $(UPSTREAM_DIR)
	git clone --depth 1 $(UPSTREAM_REPO) $(UPSTREAM_DIR)
	@echo "Upstream cloned to $(UPSTREAM_DIR)"
	@cd $(UPSTREAM_DIR) && echo "Commit: $$(git rev-parse HEAD)"

# Show raw diffs between upstream and our adapted versions
diff-upstream: sync-upstream
	@echo "=== SKILL.md ==="
	@diff -u $(UPSTREAM_DIR)/SKILL.md skills/allium/SKILL.md || true
	@echo "\n=== language-reference.md ==="
	@diff -u $(UPSTREAM_DIR)/references/language-reference.md skills/allium/references/language-reference.md || true
	@echo "\n=== patterns.md ==="
	@diff -u $(UPSTREAM_DIR)/references/patterns.md skills/allium/references/patterns.md || true
	@echo "\n=== test-generation.md ==="
	@diff -u $(UPSTREAM_DIR)/references/test-generation.md skills/allium/references/test-generation.md || true
	@echo "\n=== elicit ==="
	@diff -u $(UPSTREAM_DIR)/skills/elicit/SKILL.md skills/elicit/SKILL.md || true
	@echo "\n=== distill ==="
	@diff -u $(UPSTREAM_DIR)/skills/distill/SKILL.md skills/distill/SKILL.md || true
	@echo "\n=== propagate ==="
	@diff -u $(UPSTREAM_DIR)/skills/propagate/SKILL.md skills/propagate/SKILL.md || true
	@echo "\n=== tend ==="
	@diff -u $(UPSTREAM_DIR)/.claude/agents/tend.md agents/tend.md || true
	@echo "\n=== weed ==="
	@diff -u $(UPSTREAM_DIR)/.claude/agents/weed.md agents/weed.md || true

# Run headless pi agent to merge upstream changes into our adapted versions
update-upstream: sync-upstream
	pi -p @scripts/update-from-upstream.md --no-session

clean-upstream:
	rm -rf $(UPSTREAM_DIR)
```

### scripts/update-from-upstream.md

This is the prompt for the headless agent that performs the upstream
merge. It runs via `make update-upstream` (which calls
`pi -p @scripts/update-from-upstream.md --no-session`).

```markdown
# Update from Upstream Allium

You are updating a pi-adapted fork of the Allium project. The upstream
source has been cloned to `.upstream/`. Your job is to merge any
upstream changes into our adapted versions while preserving our
pi-specific adaptations.

## File mapping

| Upstream                              | Local                                       |
|---------------------------------------|---------------------------------------------|
| .upstream/SKILL.md                    | skills/allium/SKILL.md                      |
| .upstream/references/*                | skills/allium/references/*                  |
| .upstream/skills/elicit/SKILL.md      | skills/elicit/SKILL.md                      |
| .upstream/skills/elicit/references/*  | skills/elicit/references/*                  |
| .upstream/skills/distill/SKILL.md     | skills/distill/SKILL.md                     |
| .upstream/skills/propagate/SKILL.md   | skills/propagate/SKILL.md                   |
| .upstream/.claude/agents/tend.md      | agents/tend.md                              |
| .upstream/.claude/agents/weed.md      | agents/weed.md                              |

## Adaptation rules

When merging upstream changes, preserve these adaptations:

### Skills (SKILL.md files)

1. **Frontmatter**: Keep our pi-format frontmatter. Upstream uses
   Claude's format or no frontmatter. Our format:
   ```yaml
   ---
   name: <name>
   description: "<description>"
   auto_trigger:   # only on the allium skill
     - file_patterns: ["**/*.allium"]
     - keywords: ["allium", "allium spec"]
   ---
   ```

2. **Paths**: All references to the language reference, patterns, and
   test generation files must use paths relative to the skill directory.
   Replace any absolute paths (like `/home/.../.agents/skills/allium/...`)
   with relative paths (like `./references/language-reference.md`).
   The `allium` skill's references dir is at `skills/allium/references/`.
   Other skills reference it as `../../allium/references/language-reference.md`.

3. **Tool names**: Replace Claude-specific tool references:
   - `Glob` → use `find` and `grep` instead
   - `Read` → `read` (lowercase)
   - `Edit` → `edit` (lowercase)
   - `Write` → `write` (lowercase)

4. **Claude-specific sections**: Remove or adapt any Claude Code
   specific instructions (hooks, rules, .claude/ paths). Keep the
   methodology content — it's tool-agnostic.

### Agents (tend.md, weed.md)

1. **Frontmatter**: Upstream has no frontmatter (Claude agent format).
   Our agents use pi-subagent frontmatter. Preserve ours:
   ```yaml
   ---
   name: tend
   description: "Tend the Allium garden — modify .allium specs"
   tools: read, edit, write, grep, find, ls
   skill: allium
   extensions:
   ---
   ```
   (weed has `tools: read, grep, find, ls` — no edit/write)

2. **Startup section**: Our agents have an adapted startup that
   references the allium skill being auto-injected. Keep our version:
   ```
   ## Startup
   1. The allium skill is already loaded with the language reference
      and syntax rules.
   2. Read the relevant .allium files (use find/grep to locate them
      if not specified).
   ...
   ```

3. **Methodology content**: Keep all upstream changes to the
   methodology body (what to do, how to work, boundaries, guidelines).
   These are tool-agnostic and should be taken as-is.

### Reference files (language-reference.md, patterns.md, etc.)

These are pure Allium language documentation with no tool-specific
content. Take upstream changes verbatim — no adaptation needed.

## Process

1. For each file pair in the mapping, read both the upstream and
   local versions.

2. If they are identical (ignoring our frontmatter and known
   adaptations), skip — no update needed.

3. If upstream has changes:
   a. Identify what changed in the methodology/content (not format)
   b. Apply those content changes to our adapted version
   c. Preserve all our adaptations listed above
   d. Write the updated file

4. If upstream has NEW files not in our mapping (e.g., a new
   reference doc or a new skill), report them but don't
   automatically add them.

5. After processing all files, update UPSTREAM.md with the new
   commit SHA and today's date.

6. Print a summary of what changed, what was updated, and what
   was skipped.

## Important

- Do NOT blindly overwrite local files with upstream content.
  The whole point is to preserve our adaptations.
- Do NOT modify the extension code (extensions/pi-allium/index.ts).
  That's our code, not upstream's.
- Do NOT touch package.json, Makefile, or UPSTREAM.md format
  (only update the commit SHA and date in UPSTREAM.md).
- If you're unsure whether a change is an upstream improvement or
  conflicts with our adaptations, err on the side of preserving
  our version and noting it in the summary.
```

## Execution Order

### Phase 1: Create the repo

1. Create `johanfriis/pi.allium` on GitHub
2. Set up the directory structure and package.json
3. Copy and adapt all upstream skills (allium, elicit, distill, propagate)
4. Copy and adapt agents (tend, weed) to pi-subagent format
5. Copy the extension from agent.kit, apply the changes listed above
6. Create UPSTREAM.md documenting the fork
7. Create Makefile for upstream sync
8. Test: `pi -e ./extensions/pi-allium/index.ts` loads cleanly
9. Initial commit and push

### Phase 2: Test the package install

1. `pi install git:github.com/johanfriis/pi.allium` — verify extension
   and skills load
2. Manually copy agents to `~/.pi/agent/agents/` — verify pi-subagents
   finds them
3. Test `/tend` command delegates to subagent
4. Test `/weed` command delegates to subagent
5. Test `/workshop` works in-session
6. Test `allium_change` scaffold/list/archive
7. Test validation hook fires on .allium edits

### Phase 3: Update the library

1. Fix `default_dirs.agents` in library.yaml to use pi paths
2. Remove superseded skill entries (allium, elicit, distill, propagate,
   tend-as-skill, weed-as-skill)
3. Add agent entries (tend, weed)
4. Replace pi-allium extension entry with allium entry
5. Test `/library use allium` installs everything (extension + deps)

### Phase 4: Clean up agent.kit

1. Remove `extensions/pi-allium/` from agent.kit
2. Update agent.kit AGENTS.md if it references pi-allium
3. Commit and push

## Resolved Questions

1. **Model for agents**: `claude-sonnet-4-6`. Both tend and weed
   require real reasoning — domain modeling, spec syntax precision,
   cross-referencing code against spec semantics. Haiku is too
   risky for system-of-record work. Can add a `model` flag later
   if speed becomes a concern.

2. **Workshop as subagent?** No — stays in-session. Workshop is
   inherently conversational (explore → propose → challenge). A
   subagent would lose conversation context and interactivity,
   which are workshop's core value.

3. **Propagate**: Stays as a skill. It generates test code that
   needs to match the current project's test patterns, framework,
   and fixtures — context the main session already has. Isolating
   it means rediscovering all of that. Revisit if context window
   pressure becomes an issue.

4. **pi-allium spec**: Yes, moves to the new repo under `specs/`.
   The spec describes the extension's behavior; it belongs next to
   the code it describes. `SubagentInvocation` and
   `IsolatedSubagents` become actually true with pi-subagents.

5. **Elicit references**: The `references/*` globs in the file
   mapping handle this correctly. Notes:
   - `allium/references/` has 5 files: language-reference.md,
     patterns.md, test-generation.md, migration-v1-to-v2.md,
     migration-v2-to-v3.md
   - `elicit/references/` has library-spec-signals.md
   - `propagate` has NO references dir — it references
     allium's test-generation.md via relative path
   - `distill` has NO references dir
