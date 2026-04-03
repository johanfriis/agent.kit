/**
 * pi-allium — Pi-native tooling for Allium spec-driven development.
 *
 * Provides:
 * - `allium_change` tool for managing change folders (scaffold/list/archive)
 * - `allium_tend` tool for loading tend methodology + context
 * - `allium_weed` tool for loading weed methodology + context
 * - Validation hook that runs `allium check` after .allium file edits
 * - `/workshop` command to start an exploration session
 * - `/tend` command to invoke tend in the current session
 * - `/weed` command to invoke weed in the current session
 * - `/changes` command to list active changes
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export default function (pi: ExtensionAPI) {
	const SPECS_DIR = "specs";
	const CHANGES_DIR = path.join(SPECS_DIR, "changes");
	const ARCHIVE_DIR = path.join(CHANGES_DIR, "archive");

	// ── Helpers ─────────────────────────────────────────

	function findAlliumFiles(cwd: string): string[] {
		const specsDir = path.join(cwd, SPECS_DIR);
		const results: string[] = [];
		if (!fs.existsSync(specsDir)) return results;

		function walk(dir: string) {
			for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
				const full = path.join(dir, entry.name);
				if (entry.isDirectory() && entry.name !== "changes" && entry.name !== "archive") {
					walk(full);
				} else if (entry.isFile() && entry.name.endsWith(".allium")) {
					results.push(path.relative(cwd, full));
				}
			}
		}

		walk(specsDir);
		return results;
	}

	function findCodeFiles(cwd: string): string[] {
		const srcDir = path.join(cwd, "src");
		const results: string[] = [];
		if (!fs.existsSync(srcDir)) return results;

		function walk(dir: string) {
			for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
				const full = path.join(dir, entry.name);
				if (entry.isDirectory() && entry.name !== "node_modules") {
					walk(full);
				} else if (entry.isFile() && /\.(ts|js|py|rs|go)$/.test(entry.name)) {
					results.push(path.relative(cwd, full));
				}
			}
		}

		walk(srcDir);
		return results;
	}

	function getActiveChangeContext(cwd: string): string {
		const changesDir = path.join(cwd, CHANGES_DIR);
		if (!fs.existsSync(changesDir)) return "";

		const parts: string[] = [];
		for (const entry of fs.readdirSync(changesDir, { withFileTypes: true })) {
			if (!entry.isDirectory() || entry.name === "archive") continue;

			const changeDir = path.join(changesDir, entry.name);
			parts.push(`### Change: ${entry.name}`);

			for (const file of ["proposal.md", "design.md", "tasks.md"]) {
				const filePath = path.join(changeDir, file);
				if (fs.existsSync(filePath)) {
					const content = fs.readFileSync(filePath, "utf-8");
					parts.push(`\n**${file}:**\n${content}`);
				}
			}
		}

		return parts.join("\n");
	}

	function readSkillFile(skillName: string): string | null {
		const skillPath = path.join(os.homedir(), ".agents", "skills", skillName, "SKILL.md");
		try {
			return fs.readFileSync(skillPath, "utf-8");
		} catch {
			return null;
		}
	}

	// ── Validation Hook ─────────────────────────────────

	pi.on("tool_result", async (event, ctx) => {
		if (event.toolName !== "write" && event.toolName !== "edit") return;

		const filePath = (event as any).input?.path;
		if (!filePath || !filePath.endsWith(".allium")) return;
		if (event.isError) return;

		// Check if allium CLI is available
		try {
			const whichResult = await pi.exec("which", ["allium"], { timeout: 3000 });
			if (whichResult.code !== 0) return; // CLI not available, skip silently

			const fullPath = path.resolve(ctx.cwd, filePath);
			if (!fs.existsSync(fullPath)) return;

			const checkResult = await pi.exec("allium", ["check", fullPath], {
				timeout: 10000,
				signal: ctx.signal,
			});

			const output = (checkResult.stdout + "\n" + checkResult.stderr).trim();
			if (output && checkResult.code !== 0) {
				// Append diagnostics to the tool result
				const existingContent = event.content || [];
				return {
					content: [
						...existingContent,
						{
							type: "text" as const,
							text: `\n⚠️ Allium validation (${filePath}):\n${output}\n\nFix the reported issues before continuing.`,
						},
					],
				};
			}
		} catch {
			// Silently skip on any error
		}
	});

	// ── allium_change Tool ──────────────────────────────

	pi.registerTool({
		name: "allium_change",
		label: "Allium Change",
		description:
			"Manage Allium spec change folders. Use 'scaffold' to create a new change, 'list' to show active/archived changes, 'archive' to complete a change.",
		promptSnippet: "Manage Allium spec change folders (scaffold/list/archive)",
		parameters: Type.Object({
			action: StringEnum(["scaffold", "list", "archive"] as const),
			name: Type.Optional(
				Type.String({
					description: "Change name (kebab-case). Required for scaffold and archive.",
				})
			),
		}),

		async execute(_toolCallId, params) {
			const cwd = process.cwd();

			switch (params.action) {
				case "scaffold": {
					if (!params.name) {
						return { content: [{ type: "text", text: "Error: name is required for scaffold" }], details: {} };
					}
					const changeDir = path.join(cwd, CHANGES_DIR, params.name);
					if (fs.existsSync(changeDir)) {
						return {
							content: [{ type: "text", text: `Change '${params.name}' already exists at ${changeDir}` }],
							details: {},
						};
					}

					fs.mkdirSync(changeDir, { recursive: true });

					fs.writeFileSync(
						path.join(changeDir, "proposal.md"),
						[
							"## Why",
							"",
							"<!-- ✅ Observable behavior changes -->",
							"<!-- ❌ Implementation details -->",
							"",
							"## What changes",
							"",
							"<!-- What will change? Be specific about scope. -->",
							"",
							"## Scope",
							"",
							"### In scope",
							"",
							"### Out of scope",
							"",
							"## Impact",
							"",
							"<!-- What areas of the codebase/specs are affected? -->",
							"",
						].join("\n")
					);

					fs.writeFileSync(
						path.join(changeDir, "design.md"),
						[
							"## Approach",
							"",
							"<!-- How will this be implemented? What are the key decisions? -->",
							"",
							"## Decisions",
							"",
							"<!-- Document trade-offs and alternatives considered. -->",
							"",
						].join("\n")
					);

					fs.writeFileSync(
						path.join(changeDir, "tasks.md"),
						["## Tasks", "", "### 1. First phase", "- [ ] 1.1 First task", ""].join("\n")
					);

					return {
						content: [
							{
								type: "text",
								text: `Created change '${params.name}':\n  ${changeDir}/\n  ├── proposal.md\n  ├── design.md\n  └── tasks.md\n\nNext: fill in the proposal, then use tend/elicit to modify .allium specs.`,
							},
						],
						details: { action: "scaffold", name: params.name, path: changeDir },
					};
				}

				case "list": {
					const changesDir = path.join(cwd, CHANGES_DIR);
					const archiveDir = path.join(cwd, ARCHIVE_DIR);

					const active: string[] = [];
					const archived: string[] = [];

					if (fs.existsSync(changesDir)) {
						for (const entry of fs.readdirSync(changesDir, { withFileTypes: true })) {
							if (entry.isDirectory() && entry.name !== "archive") {
								active.push(entry.name);
							}
						}
					}

					if (fs.existsSync(archiveDir)) {
						for (const entry of fs.readdirSync(archiveDir, { withFileTypes: true })) {
							if (entry.isDirectory()) {
								archived.push(entry.name);
							}
						}
					}

					const lines: string[] = [];
					if (active.length > 0) {
						lines.push("Active changes:");
						for (const name of active.sort()) {
							lines.push(`  • ${name}`);
						}
					} else {
						lines.push("No active changes.");
					}

					if (archived.length > 0) {
						lines.push("");
						lines.push(`Archived: ${archived.length} change${archived.length === 1 ? "" : "s"}`);
						for (const name of archived.sort()) {
							lines.push(`  • ${name}`);
						}
					}

					return {
						content: [{ type: "text", text: lines.join("\n") }],
						details: { action: "list", active, archived },
					};
				}

				case "archive": {
					if (!params.name) {
						return { content: [{ type: "text", text: "Error: name is required for archive" }], details: {} };
					}

					const sourceDir = path.join(cwd, CHANGES_DIR, params.name);
					if (!fs.existsSync(sourceDir)) {
						return {
							content: [{ type: "text", text: `Change '${params.name}' not found at ${sourceDir}` }],
							details: {},
						};
					}

					const date = new Date().toISOString().slice(0, 10);
					const archiveName = `${date}-${params.name}`;
					const targetDir = path.join(cwd, ARCHIVE_DIR, archiveName);

					fs.mkdirSync(path.join(cwd, ARCHIVE_DIR), { recursive: true });
					fs.renameSync(sourceDir, targetDir);

					return {
						content: [
							{
								type: "text",
								text: `Archived '${params.name}' → changes/archive/${archiveName}/`,
							},
						],
						details: { action: "archive", name: params.name, archivedAs: archiveName },
					};
				}
			}
		},
	});

	// ── allium_tend Tool ─────────────────────────────────

	pi.registerTool({
		name: "allium_tend",
		label: "Allium Tend",
		description:
			"Load the tend agent methodology for modifying .allium specification files. Returns methodology and context — then follow the instructions to make the requested spec changes using read/edit tools.",
		promptSnippet: "Load tend methodology for modifying .allium specs, then follow the returned instructions",
		promptGuidelines: [
			"Call allium_tend when you need to modify .allium spec files. The tool returns the tend methodology — then follow it to make changes.",
		],
		parameters: Type.Object({
			request: Type.String({ description: "What changes to make to the spec" }),
			spec_file: Type.Optional(Type.String({ description: "Specific .allium file to modify (auto-detected if omitted)" })),
			change_name: Type.Optional(Type.String({ description: "Active change name for additional context" })),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const cwd = ctx.cwd;

			// Load tend methodology
			const tendSkill = readSkillFile("tend");
			if (!tendSkill) {
				throw new Error("Tend skill not found at ~/.agents/skills/tend/SKILL.md — install it first.");
			}

			// Find spec files
			const specFiles = params.spec_file ? [params.spec_file] : findAlliumFiles(cwd);
			if (specFiles.length === 0) {
				throw new Error("No .allium files found in specs/ directory.");
			}

			// Build change context
			let changeContext = "";
			if (params.change_name) {
				const changeDir = path.join(cwd, CHANGES_DIR, params.change_name);
				if (fs.existsSync(changeDir)) {
					for (const file of ["proposal.md", "design.md"]) {
						const filePath = path.join(changeDir, file);
						if (fs.existsSync(filePath)) {
							changeContext += `\n### ${file}\n${fs.readFileSync(filePath, "utf-8")}\n`;
						}
					}
				}
			} else {
				changeContext = getActiveChangeContext(cwd);
			}

			const parts: string[] = [
				"# Tend Agent Mode",
				"",
				"You are now operating as the Allium tend agent. Follow the methodology below to modify .allium specs.",
				"",
				"## Methodology",
				"",
				tendSkill,
				"",
				"## Your Task",
				"",
				`**Request:** ${params.request}`,
				"",
				`**Spec files to work with:**`,
				...specFiles.map((f) => `- \`${f}\``),
				"",
			];

			if (changeContext) {
				parts.push("## Change Context", "", changeContext, "");
			}

			parts.push(
				"## Instructions",
				"",
				"1. Read the spec file(s) listed above",
				"2. Understand the existing domain model",
				"3. Make the requested changes following the tend methodology",
				"4. Use the edit tool to modify the .allium file(s)",
				"5. The validation hook will automatically check your changes",
				""
			);

			return {
				content: [{ type: "text", text: parts.join("\n") }],
				details: { specFiles, request: params.request },
			};
		},
	});

	// ── allium_weed Tool ─────────────────────────────────

	pi.registerTool({
		name: "allium_weed",
		label: "Allium Weed",
		description:
			"Load the weed agent methodology for checking alignment between .allium specs and implementation code. Returns methodology and context — then follow the instructions to find and report divergences.",
		promptSnippet: "Load weed methodology for checking spec-code alignment, then follow the returned instructions",
		promptGuidelines: [
			"Call allium_weed to check if .allium specs and implementation code have diverged. Follow the returned methodology to find and classify divergences.",
		],
		parameters: Type.Object({
			spec_file: Type.Optional(Type.String({ description: "Specific .allium file to check (auto-detected if omitted)" })),
			code_path: Type.Optional(Type.String({ description: "Specific code file or directory to check (defaults to src/)" })),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const cwd = ctx.cwd;

			// Load weed methodology
			const weedSkill = readSkillFile("weed");
			if (!weedSkill) {
				throw new Error("Weed skill not found at ~/.agents/skills/weed/SKILL.md — install it first.");
			}

			// Find spec files
			const specFiles = params.spec_file ? [params.spec_file] : findAlliumFiles(cwd);
			if (specFiles.length === 0) {
				throw new Error("No .allium files found in specs/ directory.");
			}

			// Find code files
			const codeFiles = params.code_path ? [params.code_path] : findCodeFiles(cwd);
			if (codeFiles.length === 0) {
				throw new Error("No implementation files found in src/ directory.");
			}

			const parts: string[] = [
				"# Weed Agent Mode",
				"",
				"You are now operating as the Allium weed agent. Follow the methodology below to check spec-code alignment.",
				"",
				"## Methodology",
				"",
				weedSkill,
				"",
				"## Your Task",
				"",
				"**Spec files to check:**",
				...specFiles.map((f) => `- \`${f}\``),
				"",
				"**Implementation files to check:**",
				...codeFiles.map((f) => `- \`${f}\``),
				"",
				"## Instructions",
				"",
				"1. Read all spec files listed above",
				"2. Read all implementation files listed above",
				"3. For each entity, rule, and trigger in the spec, find the corresponding implementation",
				"4. For each significant code path, check whether the spec accounts for it",
				"5. Report every divergence with classification (spec bug, code bug, aspirational, intentional gap)",
				"6. Group findings by entity or rule",
				"",
			];

			return {
				content: [{ type: "text", text: parts.join("\n") }],
				details: { specFiles, codeFiles },
			};
		},
	});

	// ── Workshop Methodology ────────────────────────────

	const WORKSHOP_METHODOLOGY = `# Allium Workshop

You are in workshop mode. Your goal is to explore a problem space, investigate
the codebase and existing .allium specs, and produce a change folder that can
drive spec work.

## Phase 1: Explore

Start by understanding the current state:
- Read existing .allium spec files in specs/
- Read relevant implementation code in src/
- Identify the domain model, entities, rules, and surfaces
- Build a mental map before proposing anything

Ask the user what they want to change or improve. Then investigate:
- What areas of the spec/code are affected?
- What are the constraints and trade-offs?
- Are there alternative approaches?
- What uncertainties exist?

Do NOT commit to a direction yet. Explore.

## Phase 2: Propose

When the direction is clear, produce the change folder using the
allium_change tool with action "scaffold":

1. Scaffold the change folder
2. Fill in **proposal.md**:
   - Why: the problem being solved (observable behavior, not implementation)
   - What changes: specific scope
   - In/out of scope boundaries
   - Impact on existing specs and code
3. Fill in **design.md**:
   - Approach: how the spec changes will be structured
   - Key decisions and trade-offs
   - Alternatives considered
4. Fill in **tasks.md**:
   - Implementation checklist ordered by dependency

Use ✅ for observable behavior changes, ❌ for implementation details.
Surface ambiguity as Allium \`open question\` declarations, never guess.

## Phase 3: Challenge (optional)

Adversarial review of the proposal. Apply these techniques:
- **Pre-mortem**: Assume this change failed. What went wrong?
- **First principles**: What assumptions are we making? Are they valid?
- **Inversion**: What if we did the opposite?
- **Red team**: How could this proposal be attacked or misused?
- **Constraint removal**: What if we removed a constraint? Would we still need this?

Rules:
- "No issues found" is NOT acceptable. Dig deeper.
- Expect false positives — surface them anyway, let the human filter.
- If you genuinely find problems, surface them as open questions.
`;

	// ── /workshop Command ────────────────────────────────

	pi.registerCommand("workshop", {
		description: "Start an Allium workshop session — explore a problem and produce a change proposal",
		handler: async (args, ctx) => {
			const cwd = ctx.cwd;
			const specFiles = findAlliumFiles(cwd);

			let contextInfo = "";
			if (specFiles.length > 0) {
				contextInfo = `\n\nExisting spec files:\n${specFiles.map((f) => `- ${f}`).join("\n")}`;
			}

			const changeContext = getActiveChangeContext(cwd);
			if (changeContext) {
				contextInfo += `\n\nActive changes:\n${changeContext}`;
			}

			const prompt = `${WORKSHOP_METHODOLOGY}${contextInfo}\n\n${args ? `The user wants to explore: ${args}` : "Start by asking the user what they want to change or improve."}`;

			pi.sendUserMessage(prompt);
		},
	});

	// ── /tend Command ────────────────────────────────────

	pi.registerCommand("tend", {
		description: "Invoke tend agent to modify .allium specs",
		handler: async (args, ctx) => {
			const tendSkill = readSkillFile("tend");
			if (!tendSkill) {
				if (ctx.hasUI) ctx.ui.notify("Tend skill not found at ~/.agents/skills/tend/", "error");
				return;
			}

			const cwd = ctx.cwd;
			const specFiles = findAlliumFiles(cwd);
			if (specFiles.length === 0) {
				if (ctx.hasUI) ctx.ui.notify("No .allium files found in specs/", "warning");
				return;
			}

			const changeContext = getActiveChangeContext(cwd);
			const prompt = [
				"# Tend Mode",
				"",
				tendSkill,
				"",
				`Spec files: ${specFiles.map((f) => `\`${f}\``).join(", ")}`,
				changeContext ? `\n## Active Change Context\n${changeContext}` : "",
				"",
				args ? `Request: ${args}` : "What changes do you want to make to the spec? Read the spec file(s) first, then ask.",
			].join("\n");

			pi.sendUserMessage(prompt);
		},
	});

	// ── /weed Command ────────────────────────────────────

	pi.registerCommand("weed", {
		description: "Invoke weed agent to check spec-code alignment",
		handler: async (args, ctx) => {
			const weedSkill = readSkillFile("weed");
			if (!weedSkill) {
				if (ctx.hasUI) ctx.ui.notify("Weed skill not found at ~/.agents/skills/weed/", "error");
				return;
			}

			const cwd = ctx.cwd;
			const specFiles = findAlliumFiles(cwd);
			const codeFiles = findCodeFiles(cwd);

			if (specFiles.length === 0) {
				if (ctx.hasUI) ctx.ui.notify("No .allium files found", "warning");
				return;
			}

			const prompt = [
				"# Weed Mode",
				"",
				weedSkill,
				"",
				`Spec files: ${specFiles.map((f) => `\`${f}\``).join(", ")}`,
				`Code files: ${codeFiles.map((f) => `\`${f}\``).join(", ")}`,
				"",
				args
					? `Focus: ${args}`
					: "Read the spec and code files, then report all divergences with classification.",
			].join("\n");

			pi.sendUserMessage(prompt);
		},
	});

	// ── /changes Command ─────────────────────────────────

	pi.registerCommand("changes", {
		description: "List active Allium spec changes",
		handler: async (_args, _ctx) => {
			pi.sendUserMessage("Use the allium_change tool with action 'list' to show active and archived changes.");
		},
	});
}
