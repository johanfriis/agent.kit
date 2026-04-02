## Why

Allium is the strongest spec-driven development framework available. Its
formal language surfaces contradictions, enforces completeness, and
provides validation semantics that markdown specs cannot. Its agents
(tend, weed) and skills (elicit, distill, propagate) form a coherent
pipeline for specification-driven development.

However, Allium is designed for Claude Code. Pi doesn't support agents,
and Allium's integration points (rules, agents, skills, hooks) assume
Claude Code's architecture. Using Allium in pi today means manually
reading the language reference and writing specs by hand, with no
workflow support.

Meanwhile, OpenSpec (Fission-AI) has a weaker spec format (markdown with
Given/When/Then scenarios) but a genuinely useful change management
pattern: bundling proposal, design, and task artifacts alongside spec
changes, with an archive that preserves intent alongside outcomes.

pi-allium combines the best of both:
- Allium as the specification language
- OpenSpec's change folder convention for managing spec evolution
- Pi-native tooling to bridge the agent gap

## What changes

### 1. Workshop skill

A pi skill that fills the gap between Allium's `elicit` (builds specs
from scratch) and `tend` (modifies existing specs from clear
requirements). Workshop helps figure out *what* to change:

- Investigates the codebase and existing .allium specs
- Runs a low-commitment exploration conversation
- Produces change folder artifacts (proposal.md, design.md, tasks.md)
- Hands off to elicit or tend for spec work

The proposal and design become inputs for spec work. Tasks become inputs
for implementation. This is the core insight: the change folder is
**context for the spec agent**, not a workflow framework.

### 2. Change management convention

A lightweight folder convention for tracking units of work:

```
specs/changes/<change-name>/
├── proposal.md     # intent, scope, approach
├── design.md       # technical decisions, trade-offs
└── tasks.md        # implementation checklist
```

Completed changes archive to `specs/changes/archive/YYYY-MM-DD-<name>/`.
No CLI, no YAML schemas, no merge logic — just folders and git branches.

### 3. Pi extension for tool support

Register pi tools and commands that support the workflow:

- Tool for scaffolding change folders
- Tool for listing active/archived changes
- Tool for archiving completed changes
- Commands for quick access (`/workshop`, `/changes`)

### 4. Allium language support

Reference material and guidance so pi's LLM can read and write .allium
files correctly:

- Allium language reference as a skill reference
- Common patterns library
- Validation rules summary

## Scope

### In scope

- Workshop skill for the exploration/proposal phase
- Change folder convention and tooling
- Allium language reference as pi-accessible material
- Integration patterns for using elicit/tend/weed/propagate workflows
  through pi skills (since pi lacks agents)

### Out of scope

- Forking or modifying Allium itself
- Building an Allium parser or validator (that's Allium's domain)
- Replacing Allium's agents — we adapt their methodology into skills
- Multi-tool support (this is pi-only by design)

## Patterns adopted from OpenSpec

Beyond the change folder convention, several patterns from OpenSpec are
worth incorporating into pi-allium's workflow:

### Explore before committing

Allium's `elicit` jumps straight into structured spec-building. OpenSpec's
`/explore` is different — an unstructured investigation phase with zero
artifact creation. You poke around the codebase, compare approaches, ask
"what if" questions, and only commit to a change when direction
crystallizes.

This maps to the workshop skill's first phase: investigation with no
output commitment. The workshop skill should explicitly support a mode
where you're just thinking, not yet producing artifacts.

### Verify dimensions (completeness / correctness / coherence)

OpenSpec's `/verify` checks implementation against the change record
across three axes:

- **Completeness** — all tasks done, all requirements implemented, all
  scenarios covered
- **Correctness** — implementation matches spec intent, edge cases handled
- **Coherence** — design decisions reflected in code, patterns consistent

Allium's `weed` agent checks spec-code *alignment* (has the spec drifted
from the code, or vice versa), but doesn't check against a *change
record*. Weed asks "do the spec and code agree?" Verify asks "did we do
what we said we'd do in the proposal/design/tasks?"

These are complementary. Weed is ongoing maintenance. Verify is
change-scoped validation before archiving. The pi-allium weed
translation should include a verify mode that reads the change folder.

### Change stacking metadata

When multiple spec changes are in flight, ordering matters. OpenSpec
supports dependency metadata:

```yaml
dependsOn: [add-authentication]
provides: [user-sessions]
requires: [user-model]
```

For pi-allium, this can be lightweight: a `depends` field in the
proposal or a small metadata section. A skill can validate the DAG. No
CLI tooling needed — just a convention that the proposal declares
dependencies, and the workshop skill warns about conflicts.

### "Update vs start fresh" decision heuristic

When you're mid-implementation and requirements shift, you need a
framework for deciding whether to update the existing change or start a
new one:

- **Same intent, refined execution** → update the existing change
- **Scope narrowed (MVP first)** → update, archive, then new change
- **Intent fundamentally shifted** → new change
- **Original is completable standalone** → archive it, start fresh

This isn't tooling — it's guidance. The workshop skill should surface
this heuristic when scope changes during an active change.

### Project-level context declaration

OpenSpec injects project context into every AI interaction:

```yaml
context: |
  Tech stack: TypeScript, React, Node.js, PostgreSQL
  API style: RESTful
  Testing: Jest + React Testing Library
```

This helps the LLM make better abstraction decisions during elicit and
distill — knowing the tech stack helps distinguish implementation detail
from domain-level concerns. For pi-allium, a project config file or
root-level comments in a spec can serve this role.

### Onboard with real code

OpenSpec's `/onboard` walks through the full workflow using the actual
codebase — finds a real improvement, creates a real change, implements
real code. Not a tutorial with toy examples.

For pi-allium: a skill that picks a small area of existing code, distills
a spec, shows how the spec reveals something (a missing edge case, an
implicit state machine), then propagates a test. Full loop, real code,
30 minutes. Best way to sell the approach to a skeptical team.

### Patterns deliberately skipped from OpenSpec

- **Schema DAG for artifact ordering** — over-engineered for what amounts
  to "proposal before design before tasks"
- **CLI and slash command generation** — pi's extension API handles this
- **Delta spec merge logic** — git diffs work better for Allium's formal
  language than markdown ADDED/MODIFIED/REMOVED sections
- **Bulk archive with conflict detection** — proper dependency metadata
  prevents the conflicts this would detect

## Patterns from other frameworks

Three other spec-driven frameworks (lat.md, BMAD Method, spec-kit) have
ideas worth borrowing for the workshop skill and the broader workflow.

### Adversarial review (from BMAD Method)

A review technique where the reviewer *must* find problems. No "looks
good" allowed. The reviewer adopts a cynical stance — assume problems
exist and find them. Zero findings triggers a re-analysis.

This is powerful for two moments in the pi-allium workflow:

1. **After workshop produces a proposal** — before handing off to tend,
   run an adversarial pass: "assume this proposal has gaps, find them."
   This catches missing edge cases, unexamined assumptions, and scope
   creep before they become spec bugs.
2. **After weed/verify** — force the LLM to find problems with the
   implementation even when initial verification passes.

BMAD notes the important caveat: because the LLM is *instructed* to find
problems, it will find problems — even fake ones. Human filtering is
required. The value is in forcing thoroughness, not in accepting every
finding.

### Named reasoning methods for second passes (from BMAD Method)

Instead of vague "try again" or "make it better", BMAD offers named
reasoning methods the LLM applies to its own output:

- **Pre-mortem analysis** — assume the project already failed, work
  backward to find why
- **First principles thinking** — strip away assumptions, rebuild from
  ground truth
- **Inversion** — ask how to guarantee failure, then avoid those things
- **Red team vs blue team** — attack your own work, then defend it
- **Constraint removal** — drop all constraints, see what changes, add
  them back selectively
- **Stakeholder mapping** — re-evaluate from each stakeholder's perspective

The workshop skill should offer these as optional challenge passes after
producing a proposal or design. "Want to stress-test this proposal?
Pick a reasoning method." Pre-mortem analysis is particularly effective
for spec work — it consistently surfaces gaps that a standard review
misses.

### Explicit uncertainty markers (from spec-kit)

Spec-kit forces the LLM to mark ambiguities with `[NEEDS CLARIFICATION]`
rather than guessing:

```
[NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
```

Allium already has `open question` declarations for this, which is
better — it's part of the formal language rather than an ad-hoc marker.
But the *instruction pattern* is worth stealing: tell the LLM "when you
encounter ambiguity during workshop/elicit, surface it as an open
question rather than making an assumption." This should be explicit in
the workshop skill instructions.

### RAG/embeddings search over specs (from lat.md)

lat.md offers `lat search "how do we authenticate?"` — semantic search
via embeddings across the knowledge graph. This handles natural language
queries that don't match spec terminology: ask "what happens when someone
gets locked out" and it finds `rule LockoutExpires`.

For a handful of .allium files, grep works fine. For large projects with
many spec modules, or during onboarding where you don't know the
terminology yet, semantic search could be valuable. Worth noting for the
future but out of scope for v1. lat.md itself could be used alongside
Allium specs if this need arises.

### Bidirectional spec-code linking (from lat.md) — evaluated and skipped

lat.md's `// @lat:` comments create physical backlinks from code to spec
sections, with `lat check` validating that all links resolve. This is
valuable for markdown specs because markdown has no structural
identifiers — a requirement like "The system SHALL expire sessions" has
no greppable name.

Allium specs are the opposite. Everything has a specific name:
`entity Order`, `rule CancelOrder`, `entity Candidacy`. The naming
convention IS the bidirectional link. If your code model is called
`Order` and your Allium entity is `Order`, the traceability is
self-evident. Adding `// @allium: entity Order` above `class Order` is
pure noise.

Allium's weed agent already does semantic alignment checking ("does this
code do what the spec says?"). Shared naming provides structural
tracing. Explicit backlink comments would be ceremony for ceremony's
sake. Skipped.

### Template-driven LLM constraints (from spec-kit)

Spec-kit's templates constrain LLM behavior with explicit instructions:

```
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
```

This is exactly what Allium's distill and elicit skills already do (the
"why test", "could it be different test", abstraction level guidance),
but spec-kit's framing as template constraints is worth adopting in the
workshop skill's output templates. When scaffolding proposal.md and
design.md, include explicit constraint comments that guide the LLM:

```markdown
## What changes
<!-- ✅ Observable behavior changes -->
<!-- ❌ Implementation details (database schemas, API paths, frameworks) -->
```

### Patterns deliberately skipped from these frameworks

- **12+ agent personas** (BMAD) — over-engineered. One good workshop
  skill beats 12 specialized personas.
- **Party mode** (BMAD) — fun but gimmicky for spec work.
- **Constitutional articles** (spec-kit) — too rigid/heavyweight for
  a convention-based approach. Project-level context serves the same
  purpose more lightly.
- **Full knowledge graph** (lat.md) — separate tool concern. Semantic
  search over specs noted as a future possibility.
- **Bidirectional spec-code linking** (lat.md) — redundant for Allium.
  Allium's formal naming conventions make grep sufficient for
  traceability. Markdown specs need explicit backlinks because they
  lack structural identifiers; Allium specs don't.
- **Scale-adaptive intelligence** (BMAD) — marketing language for
  "skip steps on small projects." Unnecessary when the workflow is
  already lightweight.

## Impact

- `~/dev/agent.kit/extensions/pi-allium/` — new extension
- Allium language reference and patterns included as references
- Workshop methodology documented as a skill within the extension
