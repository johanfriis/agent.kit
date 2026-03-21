/**
 * Parrot Extension
 *
 * Opens the last AI response in an external text editor (respects $VISUAL
 * or $EDITOR environment variables). When you save and exit the editor,
 * the edited content is automatically sent back to the chat as your next
 * message.
 *
 * Forked from: https://github.com/normful/picadillo/blob/main/extensions/parrot.ts
 *
 * Usage:
 *   /parrot    - Open last AI message in external editor
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type {
  ExtensionContext,
  ExtensionUIContext,
} from "@mariozechner/pi-coding-agent";
import type { SessionEntry } from "@mariozechner/pi-coding-agent";
import type { TextContent } from "@mariozechner/pi-ai";
const DESCRIPTION =
  "Open last AI message in external editor, then send edited message after save";
const CUSTOM_MESSAGE_TYPE = "🦜 parrot squawking";

function findLastAssistantMessage(
  entries: SessionEntry[],
): string | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (!entry || entry.type !== "message") continue;

    const msg = entry.message;
    if (!msg || msg.role !== "assistant") continue;

    const textParts = msg.content
      .filter((c): c is TextContent => c.type === "text")
      .map((c) => c.text);

    if (textParts.length > 0) {
      return textParts.join("\n\n");
    }
  }
  return undefined;
}

function getEditorCommand(): string {
  return process.env.VISUAL || process.env.EDITOR || "";
}

interface EditorResult {
  content: string | null;
  error: string | null;
  exitCode: number | null;
}

function runEditor(filePath: string): EditorResult {
  // Clear screen before launching editor
  process.stdout.write("\x1b[2J\x1b[H");

  const editorCmd = getEditorCommand();
  if (!editorCmd) {
    return {
      content: null,
      error:
        "No editor configured. Set $VISUAL or $EDITOR environment variable.",
      exitCode: null,
    };
  }

  let exitCode: number | null = null;
  let errorMessage: string | null = null;

  try {
    const result = spawnSync(editorCmd, [filePath], {
      stdio: "inherit",
      env: process.env,
      shell: true,
    });
    exitCode = result.status;

    if (result.error) {
      errorMessage = result.error.message;
    }
    if (result.signal) {
      errorMessage = `Killed by signal: ${result.signal}`;
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  if (errorMessage) {
    return { content: null, error: errorMessage, exitCode };
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8").replace(/\n$/, "");
    return { content, error: null, exitCode };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      content: null,
      error: `Could not read edited file: ${error}`,
      exitCode,
    };
  }
}

function handleEditorResult(
  result: EditorResult,
  ui: ExtensionUIContext,
  sendMessage: ExtensionAPI["sendMessage"],
): void {
  const { content, error, exitCode } = result;

  if (error) {
    ui.notify(`Editor error: ${error}`, "error");
    return;
  }

  if (exitCode !== null && exitCode !== 0) {
    ui.notify(
      `'${getEditorCommand()}' exited with code ${exitCode}. Not sending message`,
      "warning",
    );
    return;
  }

  if (!content) {
    ui.notify("No message to send", "info");
    return;
  }

  sendMessage(
    {
      customType: CUSTOM_MESSAGE_TYPE,
      content,
      display: true,
    },
    { triggerTurn: true, deliverAs: "steer" },
  );
}

async function parrotHandler(pi: ExtensionAPI, ctx: ExtensionContext) {
  if (!ctx.hasUI) {
    ctx.ui.notify("parrot requires interactive mode", "error");
    return;
  }

  const branch = ctx.sessionManager.getBranch();
  const lastAssistantText = findLastAssistantMessage(branch);

  if (!lastAssistantText) {
    ctx.ui.notify("No assistant messages found", "error");
    return;
  }

  const tmpFile = path.join(os.tmpdir(), `pi-parrot-${Date.now()}.md`);
  try {
    fs.writeFileSync(tmpFile, lastAssistantText, "utf-8");
  } catch (err) {
    ctx.ui.notify(`Failed to create temp file: ${err}`, "error");
    return;
  }

  const result = await ctx.ui.custom<EditorResult>((tui, _theme, _kb, done) => {
    tui.stop();

    const editorResult = runEditor(tmpFile);

    tui.start();
    tui.requestRender(true);

    try {
      fs.unlinkSync(tmpFile);
    } catch (err) {
      ctx.ui.notify(`Failed to delete ${tmpFile}: ${err}`, "error");
    }

    done(editorResult);

    return { render: () => [], invalidate: () => {} };
  });

  handleEditorResult(result, ctx.ui, pi.sendMessage);
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("parrot", {
    description: DESCRIPTION,
    handler: async (_args: string, ctx: ExtensionContext) => {
      await parrotHandler(pi, ctx);
    },
  });
}
