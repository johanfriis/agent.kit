/**
 * Callout extension — a general-purpose tool for displaying highlighted text.
 *
 * The LLM calls the `callout` tool with text content and an optional title.
 * The extension renders it as a styled block with a colored background,
 * similar to how tool results are displayed.
 *
 * Any skill can use this: "use the callout tool to display this prominently."
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Box, Spacer, Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "callout",
		label: "Callout",
		description:
			"Display text as a visually highlighted block in the conversation. Use this to present summaries, results, or important output that should stand out from normal text. The content is rendered with special formatting — not as markdown.",
		parameters: Type.Object({
			content: Type.String({ description: "The text content to display" }),
			title: Type.Optional(
				Type.String({ description: "Optional title shown at the top (e.g., 'Commit d6b7fb0')" })
			),
		}),

		async execute(_toolCallId, params) {
			return {
				content: [{ type: "text", text: "Displayed callout to user." }],
				details: { content: params.content, title: params.title },
			};
		},

		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("callout"));
			if (args.title) {
				text += " " + theme.fg("muted", args.title);
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, _options, theme) {
			const { content, title } = (result.details ?? {}) as { content?: string; title?: string };
			if (!content) return new Text("", 0, 0);

			const box = new Box(1, 1, (t: string) => theme.bg("customMessageBg", t));

			if (title) {
				box.addChild(new Text(theme.fg("accent", title), 0, 0));
				box.addChild(new Spacer(1));
			}

			box.addChild(new Text(content, 0, 0));
			return box;
		},
	});
}
