/**
 * pi-allium — Pi-native tooling for Allium spec-driven development.
 *
 * Provides:
 * - `allium_change` tool for managing change folders (scaffold/list/archive)
 * - `/workshop` command to start an exploration session
 * - `/changes` command to list active changes
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import * as fs from "fs";
import * as path from "path";

export default function (pi: ExtensionAPI) {
	const SPECS_DIR = "specs";
	const CHANGES_DIR = path.join(SPECS_DIR, "changes");
	const ARCHIVE_DIR = path.join(CHANGES_DIR, "archive");

	pi.registerTool({
		name: "allium_change",
		label: "Allium Change",
		description:
			"Manage Allium spec change folders. Use 'scaffold' to create a new change, 'list' to show active/archived changes, 'archive' to complete a change.",
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
						`## Why\n\n<!-- Why is this change needed? What problem does it solve? -->\n\n## What changes\n\n<!-- What will change? Be specific about scope. -->\n\n## Scope\n\n### In scope\n\n### Out of scope\n\n## Impact\n\n<!-- What areas of the codebase/specs are affected? -->\n`
					);

					fs.writeFileSync(
						path.join(changeDir, "design.md"),
						`## Approach\n\n<!-- How will this be implemented? What are the key decisions? -->\n\n## Decisions\n\n<!-- Document trade-offs and alternatives considered. -->\n`
					);

					fs.writeFileSync(
						path.join(changeDir, "tasks.md"),
						`## Tasks\n\n### 1. First phase\n- [ ] 1.1 First task\n`
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

	pi.registerCommand("workshop", {
		description: "Start an Allium workshop session — explore a problem and produce a change proposal",
		handler: async (_args, ctx) => {
			ctx.addUserMessage(
				`I want to workshop a new change. Help me explore the problem space, investigate the codebase and any existing .allium specs, and produce a change folder (proposal.md, design.md, tasks.md) that can drive spec work.

Start by asking me what I want to change or improve. Then investigate before committing to a direction.`
			);
		},
	});

	pi.registerCommand("changes", {
		description: "List active Allium spec changes",
		handler: async (_args, ctx) => {
			ctx.addUserMessage("Use the allium_change tool with action 'list' to show active and archived changes.");
		},
	});
}
