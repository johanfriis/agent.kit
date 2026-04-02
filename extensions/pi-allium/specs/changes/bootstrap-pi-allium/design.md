## Approach

pi-allium is a pi extension that wraps Allium's methodology into
pi-native patterns. Since pi doesn't support agents, we translate
Allium's agent workflows into skills and tools.

### Architecture

```
pi-allium extension
├── tools (registered via pi's ExtensionAPI)
│   ├── allium_change     — scaffold/list/archive change folders
│   └── allium_workshop   — structured exploration tool
├── commands
│   ├── /workshop         — start a workshop session
│   └── /changes          — list active changes
└── references
    ├── language-reference.md   — Allium syntax (from upstream)
    ├── patterns.md             — common spec patterns (from upstream)
    └── workflow.md             — pi-allium specific workflow guide
```

### Agent → Skill translation

Allium's agents are long-running delegates that load the language
reference into their own conversation. Pi skills achieve similar
results through instruction files that the LLM reads on demand.

| Allium agent/skill | pi-allium equivalent | Approach |
|--------------------|----------------------|----------|
| tend (agent)       | Instructions in SKILL.md | Load language ref, modify .allium in-place |
| weed (agent)       | Instructions in SKILL.md | Compare .allium specs against code, report |
| elicit (skill)     | Reuse directly | Methodology works as-is via instructions |
| distill (skill)    | Reuse directly | Methodology works as-is via instructions |
| propagate (skill)  | Reuse directly | Methodology works as-is via instructions |
| workshop (new)     | New skill | Exploration + change folder creation |

The key difference: Claude Code agents get their own conversation
context, keeping the language reference out of the main session. In pi,
the language reference loads into the main context when needed. This
costs context window space but avoids the need for agent delegation.

### The pipeline

The change folder artifacts flow to different consumers:

```
proposal + design  →  tend/elicit (spec work)
tasks              →  you / your coding agent (implementation)
```

Workshop produces all three, then they diverge. Tend/elicit uses the
proposal to understand what should change and the design to understand
how. The coding agent uses tasks as a checklist. Clean separation.

### Change folder lifecycle

```
1. /workshop
   └── creates specs/changes/<name>/
       ├── proposal.md
       ├── design.md
       └── tasks.md

2. Spec work (on a git branch)
   └── LLM reads proposal + design as context
   └── LLM modifies .allium files in-place (tend) or creates new ones (elicit)
   └── git tracks the diff

3. Implementation
   └── LLM reads tasks.md
   └── writes code, checks off tasks

4. Verification
   └── weed: compares .allium specs against code, reports mismatches
   └── verify: checks implementation against change record
       (completeness, correctness, coherence)

5. Archive
   └── git merge the branch
   └── move change folder to specs/changes/archive/YYYY-MM-DD-<name>/
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

**`allium_change` tool** — manages change folders:
- `scaffold` action: creates the directory structure
- `list` action: shows active and archived changes
- `archive` action: moves a change to the archive with date prefix

**`/workshop` command** — starts a workshop session by injecting the
workshop skill instructions and pointing the LLM at the codebase and
existing specs.

**`/changes` command** — quick listing of active changes.

### Decisions

**Why an extension, not just a skill?**

The workshop methodology itself is pure instructions (skill-appropriate).
But managing change folders (scaffold, list, archive) benefits from
deterministic tooling — an extension can create directories, move files,
and format listings reliably without relying on the LLM to run bash
commands.

**Why bundle Allium's references rather than linking?**

Pi skills need the reference material accessible as files the LLM can
read. Bundling copies of the language reference and patterns library
means they work offline and don't depend on the upstream repo being
cloned locally. We pin to a specific version and update deliberately.

**Why not a separate skill + extension?**

The workshop skill and the change management tools are tightly coupled —
workshop creates change folders, the tool manages them. Keeping them in
one extension avoids a coordination problem.

**Why no patch format for .allium files?**

Allium specs are tightly coupled internally — adding a field to an entity
cascades across transition graphs, rules, invariants, and surfaces. A
meaningful patch would need to express interdependent modifications
across 6+ sections, which is harder to read than the modified file. Git
diffs on the full .allium files are cleaner, more readable, and already
handle merging and conflict detection.

**Why no bidirectional spec-code linking (à la lat.md)?**

Allium's formal naming conventions make explicit backlinks redundant.
`entity Order` maps to `class Order` in code; `rule CancelOrder` maps to
`cancelOrder()`. The naming convention IS the bidirectional link. Grep
provides structural tracing. Weed provides semantic checking. Adding
`// @allium: entity Order` comments would be ceremony for ceremony's sake.
Markdown specs need explicit backlinks because they lack structural
identifiers; Allium specs don't.

**Why no RAG/embeddings search?**

Code search (RAG over codebase) is a general-purpose concern, not a spec
workflow feature. Spec search (RAG over .allium files) could be useful
for large projects but is out of scope for v1 — a handful of .allium
files are greppable. lat.md or a standalone search tool could be used
alongside pi-allium if this need arises. pi-allium's scope is the spec
workflow loop: workshop → tend → propagate → implement → weed → archive.
