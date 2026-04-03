## Why

Allium is a behavioural specification language with a mature toolchain:
skills (elicit, distill, propagate) for building and generating from
specs, agents (tend, weed) for modifying specs and checking drift, a
CLI validator, and auto-loading rules for syntax guidance.

The upstream skills work in pi directly — they're instruction files,
and pi has native skill support. The agents (tend, weed) can run as
headless pi sessions with the agent instructions loaded as skills.
The CLI validator exists independently. The pieces are all there;
what's missing is the integration layer that wires them together and
the workflow tooling that sits on top.

In Claude Code, this wiring is built-in: hooks run validation after
edits, rules auto-load on `.allium` globs, agents delegate to their
own conversation context. Pi needs an extension to provide the same
integration — plus two things Allium doesn't have in any tool:

1. **Workshop** — an exploration phase before spec work. Allium's
   elicit builds specs from clear intent; tend modifies specs from
   clear requirements. Neither helps you figure out *what* to change
   when you're still investigating.

2. **Change management** — a convention for tracking units of spec
   work. Proposal, design, and task artifacts alongside the specs,
   with an archive that preserves intent alongside outcomes. Inspired
   by OpenSpec's change folder pattern.

pi-allium makes Allium a first-class citizen in pi — same validation,
same delegation model, same workflow — plus the workshop and change
management layer.

## What changes

### 1. Allium integration for pi

The extension replicates Allium's Claude Code integration using pi's
extension API:

- **Validation hook** — listens for `tool_execution_end` on `.allium`
  file writes/edits, runs `allium check`, surfaces diagnostics to the
  model inline.
- **Syntax context** — the upstream rule content (syntax guidance,
  anti-patterns, gotchas) loaded as a skill so pi knows how to
  read and write `.allium` files.
- **Subagent orchestration** — tend and weed wrapped as headless pi
  invocations (`pi -p --skill ... --no-session`) with the upstream
  agent instructions loaded as skills. The user stays in their main
  session; the extension handles delegation.

### 2. Workshop

A new exploration phase that Allium doesn't have. Fills the gap
between "I have an idea" and "I know what to specify":

- Investigates the codebase and existing .allium specs
- Runs a low-commitment exploration conversation
- Produces change folder artifacts (proposal.md, design.md, tasks.md)
- Hands off to elicit or tend for spec work

The change folder is **context for the spec agent**, not a workflow
framework. The proposal and design scope what tend/elicit should do.
Tasks scope what you or your coding agent should implement.

### 3. Change management convention

A lightweight folder convention for tracking units of work:

```
specs/changes/<change-name>/
├── proposal.md     # intent, scope, approach
├── design.md       # technical decisions, trade-offs
└── tasks.md        # implementation checklist
```

Completed changes archive to `specs/changes/archive/YYYY-MM-DD-<name>/`.
No CLI, no YAML schemas, no merge logic — just folders and git branches.

### 4. Change management tooling

Register pi tools and commands:

- `allium_change` tool — scaffold/list/archive change folders
- `/workshop` command — start an exploration session
- `/changes` command — list active changes

## Scope

### In scope

- Allium integration (validation hook, syntax context, subagent orchestration)
- Workshop skill for the exploration/proposal phase
- Change folder convention and tooling

### Out of scope

- Forking or modifying Allium itself
- Building an Allium parser or validator (that's Allium's domain)
- Multi-tool support (this is pi-only by design)

## Influences

- **OpenSpec** (Fission-AI) — change folder convention (proposal/design/
  tasks alongside specs), explore-before-committing philosophy, verify
  dimensions (completeness/correctness/coherence as distinct from
  spec-code alignment), update-vs-start-fresh heuristic for scope
  changes mid-flight.
- **BMAD Method** — adversarial review (forced problem-finding, no
  "looks good" allowed), named reasoning methods for challenge passes
  (pre-mortem, first principles, inversion, red team, constraint
  removal, stakeholder mapping).
- **spec-kit** — template-driven LLM constraints (✅/❌ markers in
  scaffold templates), explicit uncertainty surfacing (maps to Allium's
  `open question` declarations).
- **Allium's own naming conventions** — make bidirectional spec-code
  linking (à la lat.md) unnecessary. `entity Order` maps to
  `class Order`; grep provides structural tracing, weed provides
  semantic checking.

## Impact

- `~/dev/agent.kit/extensions/pi-allium/` — new extension
- Upstream Allium skills and references used directly (not forked)
- Workshop methodology and change management are net-new
