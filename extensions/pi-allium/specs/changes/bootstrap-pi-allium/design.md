## Approach

pi-allium is a pi extension that provides two things: an integration
layer that makes Allium's existing toolchain work natively in pi, and
new workflow capabilities (workshop, change management) that Allium
doesn't have in any tool.

### Architecture

```
pi-allium extension
├── integration
│   ├── validation hook   — tool_execution_end → allium check
│   ├── syntax skill      — upstream rule content as a pi skill
│   └── subagent tools    — tend/weed via headless pi sessions
├── tools
│   └── allium_change     — scaffold/list/archive change folders
├── commands
│   ├── /workshop         — start a workshop session
│   ├── /tend             — invoke tend subagent
│   ├── /weed             — invoke weed subagent
│   └── /changes          — list active changes
└── skills
    └── workshop          — exploration methodology
```

### Allium mapping

Nothing is forked. Upstream skills and agent instructions are used
directly; the extension provides the wiring.

| Allium (Claude Code) | pi-allium | How |
|----------------------|-----------|-----|
| hook (allium-check.mjs) | `tool_execution_end` event | Extension runs `allium check` after `.allium` writes/edits |
| rule (allium.md, glob-triggered) | Syntax skill | Upstream rule content registered as a pi skill |
| tend (agent) | `/tend` command | Headless `pi -p --skill tend.md --no-session` |
| weed (agent) | `/weed` command | Headless `pi -p --skill weed.md --no-session` |
| elicit (skill) | Use directly | Install upstream skill in pi |
| distill (skill) | Use directly | Install upstream skill in pi |
| propagate (skill) | Use directly | Install upstream skill in pi |
| — | Workshop (new) | Exploration + change folder creation |
| — | Change management (new) | Proposal/design/tasks convention |

The key architectural win: headless pi sessions give tend and weed
their own conversation context, just like Claude Code agents. The
language reference stays out of the main session. Same delegation
model, different mechanism.

### The pipeline

The change folder artifacts flow to different consumers:

```
proposal + design  →  tend/elicit subagent (spec work)
tasks              →  you / your coding agent (implementation)
```

Workshop produces all three, then they diverge. The tend/elicit
subagent reads the proposal and design to understand what should
change and how. The coding agent uses tasks as a checklist. Clean
separation.

### Change folder lifecycle

```
1. /workshop
   └── creates specs/changes/<name>/
       ├── proposal.md
       ├── design.md
       └── tasks.md

2. Spec work (on a git branch)
   └── /tend or elicit skill
   └── subagent reads proposal + design as context
   └── modifies .allium files in-place (tend) or creates new (elicit)
   └── validation hook runs allium check after each edit
   └── git tracks the diff

3. Implementation
   └── coding agent reads tasks.md
   └── writes code, checks off tasks

4. Verification
   └── /weed: subagent compares .allium specs against code
   └── verify: checks implementation against change record
       (completeness, correctness, coherence)

5. Archive
   └── git merge the branch
   └── allium_change tool moves folder to archive
```

### Workshop skill design

The workshop skill has three modes that flow naturally:

**Explore** — investigate with no commitment. Read the codebase, read
existing .allium specs, ask questions, compare approaches. No artifacts
produced. Exit when direction crystallizes, or abandon.

**Propose** — produce the change folder (proposal.md, design.md,
tasks.md). Templates include LLM constraints:
- `<!-- ✅ Observable behavior changes -->`
- `<!-- ❌ Implementation details -->`

When the LLM encounters ambiguity, it must surface it as an Allium
`open question` declaration rather than guessing.

**Challenge** — optional adversarial pass before handing off to tend.
Two techniques available:
- *Adversarial review*: force the LLM to find problems with the
  proposal. No "looks good" allowed. Zero findings triggers re-analysis.
  Expect false positives — human filters required.
- *Named reasoning methods*: apply a specific lens to stress-test the
  proposal. Options include pre-mortem analysis, first principles,
  inversion, red team, constraint removal, stakeholder mapping. The LLM
  suggests 3-5 relevant methods; user picks one.

### What the extension registers

**Validation hook** — `tool_execution_end` listener. When edit or
write touches a `.allium` file and the `allium` CLI is installed,
runs `allium check` and surfaces diagnostics to the model.

**`allium_change` tool** — manages change folders:
- `scaffold` action: creates the directory structure
- `list` action: shows active and archived changes
- `archive` action: moves a change to the archive with date prefix

**`/workshop` command** — starts a workshop session by injecting the
workshop skill instructions and pointing the LLM at the codebase and
existing specs.

**`/tend` command** — spawns a headless pi session with the upstream
tend agent instructions as a skill. Passes the relevant `.allium`
files and change folder context.

**`/weed` command** — spawns a headless pi session with the upstream
weed agent instructions as a skill. Passes the spec files and
implementation paths.

**`/changes` command** — quick listing of active changes.

### Decisions

**Why an extension, not just a skill?**

Three things require extension capabilities: the validation hook
(event listener), subagent orchestration (spawning headless pi
sessions), and change folder management (deterministic file
operations). A skill can only provide instructions.

**Why use upstream Allium directly instead of forking?**

Allium's skills (elicit, distill, propagate) work in pi as-is —
they're instruction files and pi has native skill support. The
agent instructions (tend, weed) work as skill files for headless
pi sessions. The language reference and patterns library are
accessible to the subagents through normal file reads. Nothing
needs to be copied, bundled, or adapted.

**Why not a separate skill + extension?**

The workshop skill, validation hook, subagent orchestration, and
change management tools are all tightly coupled — they form a
single workflow. Keeping them in one extension avoids coordination
problems.

**Why no patch format for .allium files?**

Allium specs are tightly coupled internally — adding a field to an
entity cascades across transition graphs, rules, invariants, and
surfaces. Git diffs on the full `.allium` files are cleaner, more
readable, and already handle merging and conflict detection.
