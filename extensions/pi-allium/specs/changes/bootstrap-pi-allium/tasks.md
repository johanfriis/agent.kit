## Tasks

### 1. Extension scaffold
- [x] 1.1 Create index.ts with ExtensionAPI boilerplate
- [x] 1.2 Register `allium_change` tool (scaffold/list/archive actions)
- [x] 1.3 Register `/workshop` command
- [x] 1.4 Register `/changes` command

### 2. Validation hook
- [ ] 2.1 Register `tool_execution_end` listener for edit/write on `.allium` files
- [ ] 2.2 Run `allium check` on the affected file
- [ ] 2.3 Surface diagnostics to the model (inject as follow-up context)
- [ ] 2.4 Graceful skip when `allium` CLI is not installed

### 3. Subagent orchestration
- [ ] 3.1 Implement headless pi invocation helper (`pi -p --skill ... --no-session`)
- [ ] 3.2 Register `/tend` command — spawn tend subagent with upstream instructions
- [ ] 3.3 Register `/weed` command — spawn weed subagent with upstream instructions
- [ ] 3.4 Pass change folder context (proposal + design) to tend/elicit subagents
- [ ] 3.5 Pass spec files and implementation paths to weed subagent
- [ ] 3.6 Capture and relay subagent output back to the main session

### 4. Workshop skill
- [ ] 4.1 Write workshop SKILL.md — exploration → propose → challenge flow
- [ ] 4.2 Explore mode: investigation with no artifact commitment
- [ ] 4.3 Propose mode: produce change folder (proposal.md, design.md, tasks.md)
- [ ] 4.4 Challenge mode: adversarial review + named reasoning methods
- [ ] 4.5 Surface ambiguity as `open question` declarations, don't guess
- [ ] 4.6 Add template constraints to scaffold templates (✅ behavior / ❌ implementation)

### 5. Syntax skill
- [ ] 5.1 Register upstream allium rule content as a pi skill
- [ ] 5.2 Auto-trigger on `.allium` file patterns and allium keywords

### 6. Testing
- [ ] 6.1 Test extension loads in pi (`pi -e ./index.ts`)
- [ ] 6.2 Test `allium_change` tool (scaffold, list, archive)
- [ ] 6.3 Test validation hook fires on `.allium` edits
- [ ] 6.4 Test `/tend` and `/weed` subagent invocation
- [ ] 6.5 Test `/workshop` command triggers correctly

### 7. Distribution
- [ ] 7.1 Register in agent.library
- [ ] 7.2 Install globally for testing across projects
