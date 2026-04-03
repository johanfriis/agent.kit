# pi-allium

Allium integration for [pi](https://github.com/mariozechner/pi-coding-agent),
plus workshop and change management capabilities that Allium doesn't
have in any tool.

## What this is

[Allium](https://github.com/juxt/allium) is a behavioural specification
language with a mature toolchain: skills (elicit, distill, propagate),
agents (tend, weed), a CLI validator, and auto-loading syntax rules.

Allium's skills work in pi directly. Its agents run as headless pi
sessions. This extension provides the integration layer that wires
everything together — validation hooks, subagent orchestration, syntax
context — plus two new capabilities:

- **Workshop** — an exploration phase before spec work, producing
  change folder artifacts (proposal, design, tasks)
- **Change management** — a lightweight convention for tracking units
  of spec work, inspired by [OpenSpec](https://github.com/Fission-AI/OpenSpec)

Nothing is forked. Upstream Allium is used directly.

## The workflow

```
workshop → spec work → propagate → implement → weed → archive → repeat
               │
               ├── elicit (new spec)
               └── tend   (existing spec)
```

### Change management

Each unit of work gets a change folder alongside the specs:

```
specs/
├── auth.allium                          # source of truth
├── orders.allium
└── changes/
    ├── add-cancellation-policy/
    │   ├── proposal.md                  # intent + scope
    │   ├── design.md                    # approach + trade-offs
    │   └── tasks.md                     # implementation checklist
    └── archive/
        └── 2026-04-01-initial-setup/    # completed changes
```

The proposal and design are **inputs for spec work** — they scope what
should change and constrain how. Tasks are **inputs for implementation**.
Spec modifications happen in-place on a git branch. The diff IS the patch.

### Workshop

Fills the gap between "I have an idea" and "I know what to specify":

- **Explore** — investigate the codebase and existing specs, no commitment
- **Propose** — produce the change folder (proposal, design, tasks)
- **Challenge** — adversarial review before handing off to tend/elicit

### Integration

The extension replicates Allium's Claude Code integration for pi:

- **Validation hook** — runs `allium check` after `.allium` file edits
- **Syntax skill** — upstream rule content loaded as a pi skill
- **`/tend`** — spawns headless pi session with upstream tend instructions
- **`/weed`** — spawns headless pi session with upstream weed instructions

## What's here

```
pi-allium/
├── index.ts              # Pi extension
├── README.md
└── specs/                # Dogfooded: we use the convention ourselves
    └── changes/
        └── bootstrap-pi-allium/
            ├── proposal.md
            ├── design.md
            └── tasks.md
```

## Status

Bootstrapping. See `specs/changes/bootstrap-pi-allium/` for the plan.
