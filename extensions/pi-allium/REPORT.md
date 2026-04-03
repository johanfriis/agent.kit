# pi-allium Build Report

## What was built

The pi-allium extension — a pi extension that integrates Allium spec-driven
development into pi with change management and workshop capabilities.

### Deliverables

| Artifact | Status |
|----------|--------|
| `index.ts` — Extension implementation (20KB) | ✅ Complete |
| `specs/pi-allium.allium` — Behavioural spec (8.8KB) | ✅ Complete |
| `specs/changes/bootstrap-pi-allium/` — Change artifacts | ✅ Pre-existing |
| Test project at `~/dev/pi-allium-test/` | ✅ Created |

### Capabilities implemented

| Capability | Implementation |
|------------|---------------|
| `allium_change` tool (scaffold/list/archive) | Tool — model-callable |
| `allium_tend` tool (load tend methodology) | Tool — returns instructions |
| `allium_weed` tool (load weed methodology) | Tool — returns instructions |
| Validation hook (.allium file edits) | `tool_result` event listener |
| `/workshop` command | Injects workshop methodology |
| `/tend` command | Injects tend methodology |
| `/weed` command | Injects weed methodology |
| `/changes` command | Lists active/archived changes |

## Implementation iterations

**1 iteration (iteration 0).** The initial implementation passed the E2E test
on the first attempt. No retries were needed.

## E2E test results

Full Allium workflow exercised in `~/dev/pi-allium-test/`:

| Step | Result | Details |
|------|--------|---------|
| 1. Scaffold | ✅ PASS | Created `specs/changes/add-refund-policy/` with 3 template files |
| 2. Workshop | ✅ PASS | Filled proposal.md, design.md, tasks.md with substantive content |
| 3. Tend | ✅ PASS | Modified `orders.allium`: added `refund_requested` status, `RefundRequest` value type, `RequestRefund` rule, `refund_window` config, updated transitions and surface |
| 4. Propagate | ✅ PASS | Generated `test-plan.md` with 17 specific test obligations |
| 5. Weed | ✅ PASS | Found 8 divergences: 4 pre-existing + 4 new from refund policy |
| 6. Archive | ✅ PASS | Moved to `specs/changes/archive/2026-04-03-add-refund-policy/` |

The weed report correctly identified all 4 intentional divergences planted
in `src/orders.ts`:
- Customer `fullName` vs spec `name`
- Missing `DeliverOrder` implementation
- Missing cancellation window check in `CancelOrder`
- Missing `shipped_at` assignment in `ShipOrder`

Plus 4 new divergences from the refund policy additions to the spec.

## Spec-code divergences (pi-allium itself)

Comparing `pi-allium.allium` against `index.ts`:

### Aligned (6 items)
- Change management lifecycle (scaffold/list/archive)
- Validation hook with graceful degradation
- UniqueActiveChangeNames invariant (scaffold checks existence)
- ArchiveHasDatePrefix invariant (date prefix in archive names)
- Workshop methodology (explore/propose/challenge)
- Tend and weed functionality via tools + commands

### Divergences (6 items)

| # | Divergence | Classification |
|---|-----------|---------------|
| 1 | Spec says "headless pi sessions" for tend/weed; code uses in-session methodology injection | Intentional gap |
| 2 | IsolatedSubagents guarantee not met — same session context | Spec-ahead |
| 3 | WorkshopSession entity with mode transitions not tracked as state | Aspirational |
| 4 | WorkshopPropose/Challenge as separate rules — code embeds all phases in one prompt | Intentional gap |
| 5 | Config for skill paths — code hardcodes `~/.agents/skills/` | Minor code gap |
| 6 | SubagentCompletes rule — no async completion since tools are synchronous | Intentional gap |

The primary divergence theme: the spec models tend/weed as isolated subagents
with their own conversation context. The implementation uses in-session
methodology injection instead. This is a pragmatic trade-off — true subagent
isolation requires working `pi` subprocesses, which proved unreliable.

## Open questions from the spec

1. **Workshop challenge mode** — Should it be mandatory before handing off
   to tend, or always optional? Currently optional in the implementation.

2. **Auto-detection** — Should the extension auto-detect spec files and code
   paths for weed? Currently auto-detects from `specs/` and `src/` with
   optional override parameters.

3. **Archive retention** — Should archived changes be prunable after a
   configurable retention period? Not implemented.

## What needs manual attention

1. **Subagent isolation** — The current in-session approach works but doesn't
   give tend/weed their own context window. If this matters for large codebases,
   the subagent spawning mechanism needs debugging (pi subprocess output
   capture was unreliable in testing).

2. **Syntax skill** — Task 5.1-5.2 (register upstream allium rule content as
   a pi skill, auto-trigger on .allium patterns) is partially addressed by the
   tend/weed tools loading skill content, but there's no standalone syntax
   context injection when the user is editing .allium files directly.

3. **Validation hook testing** — The `allium` CLI is not installed in this
   environment, so the validation hook couldn't be tested end-to-end. The
   graceful-skip path works; the diagnostic-surfacing path is untested.

4. **Workshop state tracking** — The spec models WorkshopSession with mode
   transitions. The implementation uses a stateless approach (inject
   methodology, let the model follow it). If stateful tracking is desired,
   use `pi.appendEntry()` for persistence across turns.

5. **Distribution** — Tasks 7.1-7.2 (register in agent.library, install
   globally) are deferred for a separate decision.
