## Tasks

### 1. Extension scaffold
- [ ] 1.1 Create index.ts with ExtensionAPI boilerplate
- [ ] 1.2 Register `allium_change` tool (scaffold/list/archive actions)
- [ ] 1.3 Register `/workshop` command
- [ ] 1.4 Register `/changes` command

### 2. Allium reference material
- [ ] 2.1 Copy language-reference.md from upstream (pin to current version)
- [ ] 2.2 Copy patterns.md from upstream
- [ ] 2.3 Copy distill SKILL.md methodology
- [ ] 2.4 Copy elicit SKILL.md methodology
- [ ] 2.5 Copy propagate SKILL.md methodology
- [ ] 2.6 Write workflow.md — pi-allium specific workflow guide

### 3. Workshop skill instructions
- [ ] 3.1 Write workshop methodology (exploration → change folder creation)
- [ ] 3.2 Document handoff to elicit (new spec) or tend (existing spec)
- [ ] 3.3 Include the "update vs start fresh" decision heuristic
- [ ] 3.4 Include project-level context convention
- [ ] 3.5 Include explore-before-committing mode (investigation with no artifacts)
- [ ] 3.6 Add adversarial review pass (forced "find problems" after proposal)
- [ ] 3.7 Add named reasoning methods menu (pre-mortem, first principles, etc.)
- [ ] 3.8 Add explicit instruction: surface ambiguity as open questions, don't guess
- [ ] 3.9 Add template constraints to scaffold templates (✅ behavior / ❌ implementation)

### 4. Tend/weed skill translations
- [ ] 4.1 Write tend instructions for pi (load ref, modify .allium in-place)
- [ ] 4.2 Write weed instructions for pi (compare spec vs code, report)
- [ ] 4.3 Add verify mode to weed (check implementation against change record)
- [ ] 4.4 Document the three verify dimensions: completeness, correctness, coherence

### 5. Change stacking support
- [ ] 5.1 Document dependency convention (depends field in proposal)
- [ ] 5.2 Add dependency awareness to workshop skill (warn on conflicts)

### 6. Onboarding
- [ ] 6.1 Write onboard skill (distill → reveal → propagate on real code)

### 7. Testing
- [ ] 7.1 Test extension loads in pi (`pi -e ./index.ts`)
- [ ] 7.2 Test change scaffolding creates correct directory structure
- [ ] 7.3 Test change archiving moves folder with date prefix
- [ ] 7.4 Test workshop command triggers correctly

### 8. Distribution
- [ ] 8.1 Register in agent.library
- [ ] 8.2 Install globally for testing across projects
