# pi-allium orchestration

You are the orchestrator for developing the pi-allium extension. Your
job is to drive the full Allium workflow — from spec creation through
implementation — then validate the result by running a complete
end-to-end Allium workflow in a test project using the extension.

## Subagent mechanism

Use the `interactive_shell` tool in **dispatch** mode to run subagents.
This gives the user visibility and notifies you on completion.

```
# Dispatch a subagent (non-blocking, notified on completion)
interactive_shell({
  command: 'cd /path && pi -p @/tmp/prompt.md --skill ~/.agents/skills/X/SKILL.md --no-session',
  mode: "dispatch",
  background: true,
  reason: "Description of what this subagent does"
})

# When notified of completion, attach to review output
interactive_shell({ attach: "session-id" })
```

For complex prompts, always write a temp prompt file and use `@file`
rather than inlining long text in bash. This avoids quoting issues.

## Project layout

The extension source lives in this repo:
```
~/dev/agent.kit/extensions/pi-allium/
├── index.ts                    # Extension code (build here)
├── orchestrate.md              # This file
├── README.md
└── specs/
    ├── pi-allium.allium        # Behavioural spec (create in Phase 1)
    └── changes/
        └── bootstrap-pi-allium/
            ├── proposal.md     # What we're building
            ├── design.md       # How we're building it
            └── tasks.md        # Implementation checklist
```

The test project exercises the extension end-to-end:
```
~/dev/pi-allium-test/
├── specs/
│   ├── orders.allium           # Sample spec for a simple order domain
│   └── changes/
├── src/
│   └── orders.ts               # Intentionally divergent implementation
└── .pi/
    └── settings.json           # Extension source configured
```

## Context

Change proposal artifacts:
- `extensions/pi-allium/specs/changes/bootstrap-pi-allium/proposal.md`
- `extensions/pi-allium/specs/changes/bootstrap-pi-allium/design.md`
- `extensions/pi-allium/specs/changes/bootstrap-pi-allium/tasks.md`

Upstream Allium skills installed at `~/.agents/skills/`:
- `allium` — language reference + syntax rules
- `elicit` — build specs through structured conversation
- `distill` — extract specs from existing code
- `propagate` — generate tests from specs
- `tend` — modify/grow .allium specs
- `weed` — check spec-code alignment

Allium language reference:
`~/.agents/skills/allium/references/language-reference.md`

## Iteration tracking

The implement → test loop uses a file-based counter to survive context
drift (compaction, long runs):

```
/tmp/pi-allium-iteration.txt    # Current iteration number
/tmp/pi-allium-failures.txt     # Failures from last test run
```

**Always read the counter before each loop iteration.** Do not rely on
your memory of the count — the file is the source of truth.

Max iterations: 5. If reached, proceed to reporting regardless.

## Plan

### Phase 0: Setup

1. Read the change folder artifacts (proposal.md, design.md, tasks.md)
2. Read the existing index.ts scaffold
3. Create the test project at `~/dev/pi-allium-test/`:
   - `git init`
   - Create `specs/orders.allium` — a simple order management domain
     with entities (Order, Customer), rules (CreateOrder,
     CancelOrder, ShipOrder), transitions, and a surface. Enough
     to exercise validation, tend, weed, and the full pipeline.
   - Create `src/orders.ts` — a basic implementation that
     **intentionally has a few divergences** from the spec (e.g.
     missing a cancellation rule, wrong field name). Weed needs
     something to find.
   - Create `specs/changes/` directory
   - Commit the initial state
4. Initialize iteration counter:
   ```bash
   echo "0" > /tmp/pi-allium-iteration.txt
   echo "" > /tmp/pi-allium-failures.txt
   ```

### Phase 1: Build the Allium spec for pi-allium

**Goal:** Create `extensions/pi-allium/specs/pi-allium.allium` that
describes the extension's behavioural contract.

**How:** Dispatch an elicit subagent. Because elicit is designed for
interactive conversation but we're running headless, front-load all
context. Read the proposal, design, and existing index.ts, then write
a detailed prompt that gives the subagent everything it needs.

The elicit prompt should include:
- Full proposal and design content
- The domain: an extension that manages spec changes, orchestrates
  subagents, validates .allium files, and provides a workshop workflow
- Key entities, behaviours, surfaces, and constraints
- Instruction to produce a complete `.allium` spec file

After completion, extract the `.allium` content from the output and
write it to `extensions/pi-allium/specs/pi-allium.allium`.

If refinement is needed, dispatch a tend subagent.

### Phase 2: Implement → Test loop

#### 2a: Implement

Dispatch a coding subagent to build the extension in
`extensions/pi-allium/index.ts`. The prompt should reference:
- `extensions/pi-allium/specs/pi-allium.allium` for behaviour
- `extensions/pi-allium/specs/changes/bootstrap-pi-allium/tasks.md`
- The existing index.ts as starting point

On iteration 0, build the initial implementation.
On subsequent iterations, include the failures from
`/tmp/pi-allium-failures.txt` so the subagent knows what to fix.

#### 2b: Test — full Allium workflow in the test project

This is the acceptance test. The extension must be able to drive a
**complete Allium workflow** in the test project. The test runs
the pipeline end-to-end:

Dispatch a test subagent that loads the extension and runs the
full pipeline in the test project:

```
interactive_shell({
  command: 'cd ~/dev/pi-allium-test && pi -p @/tmp/e2e-test-prompt.md -e ~/dev/agent.kit/extensions/pi-allium/index.ts --no-session',
  mode: "dispatch",
  background: true,
  reason: "E2E test: full Allium workflow in test project"
})
```

The e2e test prompt should instruct the test agent to:

1. **Change management** — use `allium_change` tool to scaffold a
   new change called `add-refund-policy`
2. **Workshop** — use `/workshop` to explore adding a refund policy
   to the orders spec (the workshop should produce/fill the change
   folder artifacts)
3. **Spec work** — use `/tend` to modify `orders.allium` based on
   the workshop output (add refund rules, update transitions)
4. **Propagate** — use the propagate skill to generate tests from
   the updated spec
5. **Weed** — use `/weed` to check alignment between the updated
   spec and `src/orders.ts` (should find divergences, including
   the intentional ones plus the new refund policy)
6. **Archive** — use `allium_change` to archive the completed change

The test agent should report pass/fail for each step with details
on what happened.

#### 2c: Evaluate

Read the test output. If the full workflow completed successfully,
proceed to Phase 3.

If any step failed:
1. Read the current iteration count from `/tmp/pi-allium-iteration.txt`
2. Check against max (5). If reached, proceed to Phase 3.
3. Write the failures to `/tmp/pi-allium-failures.txt`
4. Increment the counter:
   ```bash
   ITER=$(cat /tmp/pi-allium-iteration.txt)
   echo "$((ITER + 1))" > /tmp/pi-allium-iteration.txt
   ```
5. Go back to 2a with a targeted fix prompt

### Phase 3: Weed the extension itself

**Goal:** Check alignment between `pi-allium.allium` and the final
implementation.

Dispatch a weed subagent pointed at:
- Spec: `extensions/pi-allium/specs/pi-allium.allium`
- Code: `extensions/pi-allium/index.ts`

### Phase 4: Report

Write `extensions/pi-allium/REPORT.md` with:

1. What was built
2. How many implementation iterations were needed
3. E2E test results (which pipeline steps passed/failed)
4. Spec-code divergences from the weed phase
5. Open questions from the spec
6. What needs manual attention

## Execution rules

- **Be autonomous.** Run all phases without asking for user input.
- **Be thorough.** Read subagent output carefully. If something went
  wrong, fix it or retry before proceeding.
- **Be transparent.** Before each subagent call, state what you're
  about to do and why. After each call, summarize the result.
- **Capture everything.** Write all subagent prompts to `/tmp/` for
  later inspection.
- **Don't skip phases.** This is a dogfooding exercise — the full
  pipeline must run.
- **Read the iteration counter from file** before every loop
  iteration. The file is the source of truth, not your memory.
- **Keep subagent prompts focused.** One concern per subagent. Front-
  load all needed context since subagents can't ask questions.
- **The E2E test is the acceptance criterion.** The extension is
  complete when it can drive a full Allium workflow (change →
  workshop → tend → propagate → weed → archive) in the test project.

## Start now

Begin with Phase 0. Read the change folder artifacts, set up the test
project, and proceed through all phases.
