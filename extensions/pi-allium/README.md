# pi-allium

Pi-native tooling that complements [Allium](https://github.com/juxt/allium)
without forking it.

## What this is

Allium is a behavioural specification language — a formal syntax for
expressing what systems should do. It comes with agents (`tend`, `weed`)
and skills (`elicit`, `distill`, `propagate`) designed for Claude Code.

Pi doesn't support agents. This extension bridges that gap by providing
pi-native tools and skills that implement the same workflows, plus a
lightweight change management convention inspired by
[OpenSpec](https://github.com/Fission-AI/OpenSpec).

## The workflow

```
workshop → spec work → propagate → implement → weed → archive → repeat
               │
               ├── elicit (new spec)
               └── tend   (existing spec)
```

### Change management convention

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
            ├── proposal.md
            ├── design.md
            └── tasks.md
```

The proposal and design are **inputs for spec work** — they scope what
should change and constrain how. Tasks are **inputs for implementation**.
Actual spec modifications happen in-place on a git branch. The diff IS
the patch.

### Workshop phase

The workshop skill fills the gap between Allium's existing tools:

- **elicit** builds a spec from scratch through structured conversation
- **tend** modifies an existing spec from clear requirements
- **workshop** helps you figure out *what* to change before either of
  those. It investigates the codebase and existing specs, helps you
  think through the change, and produces the change folder artifacts
  (proposal, design, tasks).

### Pipeline

**From a blank repo:**

```
workshop → elicit → propagate → implement → weed → archive
```

**With existing specs:**

```
workshop → tend → propagate → implement → weed → archive
```

The proposal and design flow to spec work (elicit/tend). Tasks flow to
you or your coding agent. Git manages the branch and diff. On completion,
merge the branch and move the change folder to `changes/archive/`.

## What's here

```
pi-allium/
├── index.ts              # Pi extension (tools + commands)
├── README.md             # This file
└── specs/                # Dogfooded: we use the convention ourselves
    └── changes/
        └── bootstrap-pi-allium/
            ├── proposal.md
            ├── design.md
            └── tasks.md
```

## Status

Bootstrapping. See `specs/changes/bootstrap-pi-allium/` for the plan.
