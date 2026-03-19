/**
 * pi-tmux-window-name — forked from github.com/default-anton/pi-tmux-window-name
 *
 * Tmux window title format:
 *   Active:   π[project] Topic
 *   On exit:  project
 *
 * Project resolution (starship-style):
 *   - Inside a git repo → repo name (e.g. agent.kit)
 *   - Outside a git repo → path relative to $HOME, truncated (e.g. ~, ~/dev)
 *
 * Mobile-aware topic length:
 *   - Narrow terminals (≤80 cols): 1–3 words
 *   - Wide terminals (>80 cols):   3–5 words
 *
 * Pi session name (/sessions list): unchanged, LLM-generated 8–12 words
 */

import { completeSimple, type UserMessage } from "@mariozechner/pi-ai";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  SessionEntry,
} from "@mariozechner/pi-coding-agent";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";

// ── Constants ────────────────────────────────────────────────────────────────

const SESSION_WORD_MIN = 8;
const SESSION_WORD_MAX = 12;
const SESSION_CHAR_MAX = 96;
const REQUEST_TIMEOUT_MS = 30_000;
const NAMING_SOURCE_CHAR_MAX = 4000;
const WINDOW_NAME_ENTRY_TYPE = "pi-tmux-window-name/window";
const NARROW_WIDTH_THRESHOLD = 80;

// ── Types ────────────────────────────────────────────────────────────────────

type NamingSource = "user_message" | "conversation";
type RenameFailureReason =
  | "missing_prompt"
  | "missing_model"
  | "missing_api_key"
  | "request_failed"
  | "invalid_output"
  | "skipped"
  | "stale_session";

type GenerateNamesResult =
  | { ok: true; names: GeneratedNames }
  | { ok: false; reason: Exclude<RenameFailureReason, "skipped" | "stale_session"> };

type RenameResult =
  | { ok: true; names: GeneratedNames }
  | { ok: false; reason: RenameFailureReason };

type GeneratedNames = {
  windowTopic: string;
  sessionName: string;
};

// ── Project detection ────────────────────────────────────────────────────────

function getProjectName(cwd: string): string {
  // Try git repo root
  try {
    const root = execSync("git rev-parse --show-toplevel", {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (root) return path.basename(root);
  } catch {
    // Not a git repo — fall through
  }

  // Starship-style path relative to home
  const home = homedir();
  if (cwd === home) return "~";
  if (cwd.startsWith(home + "/")) return "~/" + path.relative(home, cwd).split("/")[0];
  return cwd;
}

// ── Terminal width detection ─────────────────────────────────────────────────

function isNarrowTerminal(): boolean {
  if (!process.env.TMUX) return false;
  try {
    const width = parseInt(
      execSync("tmux display-message -p '#{client_width}'", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim(),
      10,
    );
    return !isNaN(width) && width <= NARROW_WIDTH_THRESHOLD;
  } catch {
    return false;
  }
}

// ── LLM prompt ───────────────────────────────────────────────────────────────

function buildSystemPrompt(narrow: boolean): string {
  const topicRange = narrow ? "1-3" : "3-5";
  return `You generate names for coding sessions.

Return exactly two lines:
TOPIC: <${topicRange} words>
SESSION: <8-12 words>

Rules:
- Keep both names specific to the user's task.
- Use plain letters and numbers only.
- Use spaces between words. No punctuation.
- Use sentence case (capitalize only the first word unless a word is already mixed-case or all caps).
- No quotes, markdown, emojis, labels beyond TOPIC:/SESSION:, or explanations.
- The TOPIC is a very short summary for a tmux window title — ${narrow ? "bias towards 1–2 words" : "aim for 3–4 words"}.
- The SESSION name should be descriptive enough for quickly scanning a session list.

Examples:
TOPIC: Fix OAuth callback
SESSION: Implement OAuth callback validation and retry flow in auth service`;
}

// ── Text extraction helpers ──────────────────────────────────────────────────

function normalizeWords(value: string): string[] {
  return value
    .replace(/[\n\r\t]+/g, " ")
    .replace(/["'`\u201C\u201D\u2018\u2019]/g, " ")
    .replace(/[^A-Za-z0-9\s-]/g, " ")
    .replace(/[-_]+/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

function compactTopic(value: string, maxWords: number, minWords = 1): string | undefined {
  const words = normalizeWords(value).slice(0, maxWords);
  if (words.length < minWords) return undefined;
  const name = words.join(" ").trim();
  return name || undefined;
}

function compactSessionName(value: string, minWords = SESSION_WORD_MIN): string | undefined {
  const words = normalizeWords(value).slice(0, SESSION_WORD_MAX);
  if (words.length < minWords) return undefined;
  while (words.length > minWords && words.join(" ").length > SESSION_CHAR_MAX) {
    words.pop();
  }
  const name = words.join(" ").trim();
  if (!name) return undefined;
  if (name.length <= SESSION_CHAR_MAX) return name;
  return name.slice(0, SESSION_CHAR_MAX).trim() || undefined;
}

function cleanGeneratedValue(value: string): string {
  return value.replace(/^[\s"'`]+|[\s"'`]+$/g, "").trim();
}

function parseGeneratedNames(value: string): { topic?: string; session?: string } {
  const lines = value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let topic: string | undefined;
  let session: string | undefined;

  for (const line of lines) {
    if (!topic) {
      const m = line.match(/topic\s*:\s*(.*?)(?=\bsession\s*:|$)/i);
      if (m?.[1]) topic = cleanGeneratedValue(m[1]);
    }
    if (!session) {
      const m = line.match(/session\s*:\s*(.*)$/i);
      if (m?.[1]) session = cleanGeneratedValue(m[1]);
    }
    if (topic && session) break;
  }

  return { topic, session };
}

// ── Session entry helpers ────────────────────────────────────────────────────

function getStoredWindowTopic(entries: SessionEntry[]): string | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type !== "custom") continue;
    if (entry.customType !== WINDOW_NAME_ENTRY_TYPE) continue;
    if (!entry.data || typeof entry.data !== "object") continue;

    const candidate = (entry.data as Record<string, unknown>).windowTopic;
    if (typeof candidate !== "string") continue;

    const normalized = compactTopic(candidate, 5, 1);
    if (normalized) return normalized;
  }
  return undefined;
}

function extractTextFromMessageContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (part): part is { type: "text"; text: string } =>
        !!part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part,
    )
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function getFirstUserPrompt(entries: SessionEntry[]): string | undefined {
  for (const entry of entries) {
    if (entry.type !== "message") continue;
    if (entry.message.role !== "user") continue;
    const text = extractTextFromMessageContent(entry.message.content);
    if (text) return text;
  }
  return undefined;
}

function buildConversationNamingSource(entries: SessionEntry[]): string | undefined {
  const messages: string[] = [];
  for (const entry of entries) {
    if (entry.type !== "message") continue;
    const role = entry.message.role;
    if (role !== "user" && role !== "assistant") continue;
    const text = extractTextFromMessageContent(entry.message.content);
    if (!text) continue;
    messages.push(`<${role}>\n${text}\n</${role}>`);
  }
  const conversation = messages.join("\n\n").trim();
  return conversation || undefined;
}

function formatNamingPrompt(seed: string, source: NamingSource): string {
  const tag = source === "conversation" ? "conversation" : "user_message";
  const content = seed.trim().slice(0, NAMING_SOURCE_CHAR_MAX);
  return `<${tag}>\n${content}\n</${tag}>\n\nRespond now using exactly this format:\nTOPIC: short topic\nSESSION: 8-12 words`;
}

// ── Tmux helpers ─────────────────────────────────────────────────────────────

function formatWindowTitle(project: string, topic?: string): string {
  if (topic) return `π[${project}] ${topic}`;
  return `π[${project}]`;
}

async function renameTmuxWindow(pi: ExtensionAPI, title: string): Promise<boolean> {
  if (!process.env.TMUX) return false;
  try {
    const result = await pi.exec("tmux", ["rename-window", title]);
    return result.code === 0;
  } catch {
    return false;
  }
}

// ── Name generation ──────────────────────────────────────────────────────────

async function generateNames(
  prompt: string,
  source: NamingSource,
  ctx: ExtensionContext,
): Promise<GenerateNamesResult> {
  const seed = prompt.trim();
  if (!seed) return { ok: false, reason: "missing_prompt" };
  if (!ctx.model) return { ok: false, reason: "missing_model" };

  const apiKey = await ctx.modelRegistry.getApiKey(ctx.model);
  if (!apiKey) return { ok: false, reason: "missing_api_key" };

  const narrow = isNarrowTerminal();
  const message: UserMessage = {
    role: "user",
    content: [{ type: "text", text: formatNamingPrompt(seed, source) }],
    timestamp: Date.now(),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await completeSimple(
      ctx.model,
      { systemPrompt: buildSystemPrompt(narrow), messages: [message] },
      { apiKey, reasoning: "none", maxTokens: 96, signal: controller.signal },
    );
  } catch {
    return { ok: false, reason: "request_failed" };
  } finally {
    clearTimeout(timeoutId);
  }

  const generated = response.content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");

  const parsed = parseGeneratedNames(generated);
  const maxTopicWords = narrow ? 3 : 5;
  const windowTopic = compactTopic(parsed.topic ?? "", maxTopicWords);
  const sessionName = compactSessionName(parsed.session ?? "");

  if (!windowTopic || !sessionName) return { ok: false, reason: "invalid_output" };

  return { ok: true, names: { windowTopic, sessionName } };
}

// ── Failure descriptions ─────────────────────────────────────────────────────

function describeRenameFailure(reason: RenameFailureReason): string {
  switch (reason) {
    case "missing_prompt":
      return "No user or assistant text found in the current branch.";
    case "missing_model":
      return "No active model is selected for generating a session name.";
    case "missing_api_key":
      return "No API key is available for the active model.";
    case "request_failed":
      return "Session rename request failed.";
    case "invalid_output":
      return "The model returned an invalid session name format.";
    case "stale_session":
      return "Session changed before rename completed.";
    case "skipped":
      return "Session rename was skipped.";
  }
}

function notify(ctx: ExtensionContext | ExtensionCommandContext, message: string, level: "info" | "error") {
  if (!ctx.hasUI) return;
  ctx.ui.notify(message, level);
}

// ── Extension entry point ────────────────────────────────────────────────────

export default function tmuxWindowNameExtension(pi: ExtensionAPI) {
  let hasNameForSession = false;
  let hasAttemptedNameForSession = false;
  let renameInFlight: Promise<RenameResult> | null = null;
  let sessionEpoch = 0;
  let currentProject = "";

  const resetSessionState = () => {
    sessionEpoch += 1;
    hasNameForSession = false;
    hasAttemptedNameForSession = false;
    renameInFlight = null;
  };

  const resolveProject = (ctx: ExtensionContext) => {
    currentProject = getProjectName(ctx.cwd);
  };

  const persistNames = async (names: GeneratedNames) => {
    pi.setSessionName(names.sessionName);
    pi.appendEntry(WINDOW_NAME_ENTRY_TYPE, { windowTopic: names.windowTopic });
    await renameTmuxWindow(pi, formatWindowTitle(currentProject, names.windowTopic));
    hasNameForSession = true;
    hasAttemptedNameForSession = true;
  };

  const runRename = async (
    prompt: string | undefined,
    source: NamingSource,
    ctx: ExtensionContext,
    options?: { force?: boolean },
  ): Promise<RenameResult> => {
    const force = options?.force ?? false;

    if (!force && (hasNameForSession || hasAttemptedNameForSession || renameInFlight)) {
      return { ok: false, reason: "skipped" };
    }

    const seed = prompt?.trim();
    if (!seed) return { ok: false, reason: "missing_prompt" };

    if (!force) hasAttemptedNameForSession = true;

    const currentEpoch = sessionEpoch;
    const work = (async (): Promise<RenameResult> => {
      const result = await generateNames(seed, source, ctx);
      if (!result.ok) return result;
      if (currentEpoch !== sessionEpoch) return { ok: false, reason: "stale_session" };
      await persistNames(result.names);
      return { ok: true, names: result.names };
    })();

    const inFlight = work.finally(() => {
      if (renameInFlight === inFlight) renameInFlight = null;
    });

    renameInFlight = inFlight;
    return inFlight;
  };

  const applyAutoName = async (seedPrompt: string | undefined, ctx: ExtensionContext): Promise<void> => {
    const existing = pi.getSessionName();
    if (existing) {
      // Restore from stored topic or fall back to compacted session name
      const storedTopic = getStoredWindowTopic(ctx.sessionManager.getBranch());
      await renameTmuxWindow(pi, formatWindowTitle(currentProject, storedTopic ?? compactTopic(existing, 5, 1)));
      hasNameForSession = true;
      hasAttemptedNameForSession = true;
      return;
    }

    await runRename(seedPrompt, "user_message", ctx);
  };

  const restoreExistingSessionName = async (ctx: ExtensionContext) => {
    resolveProject(ctx);

    const existing = pi.getSessionName();
    if (!existing) {
      // New session with no name yet — show bare π[project]
      await renameTmuxWindow(pi, formatWindowTitle(currentProject));
      return;
    }

    const storedTopic = getStoredWindowTopic(ctx.sessionManager.getBranch());
    const topic = storedTopic ?? compactTopic(existing, 5, 1) ?? existing;
    await renameTmuxWindow(pi, formatWindowTitle(currentProject, topic));
    hasNameForSession = true;
    hasAttemptedNameForSession = true;
  };

  const renameFromBranch = async (args: string, ctx: ExtensionCommandContext) => {
    if (args.trim()) {
      notify(ctx, "/rename does not take arguments", "error");
      return;
    }

    await ctx.waitForIdle();
    if (renameInFlight) await renameInFlight;

    const conversation = buildConversationNamingSource(ctx.sessionManager.getBranch());
    const result = await runRename(conversation, "conversation", ctx, { force: true });

    if (!result.ok) {
      notify(ctx, describeRenameFailure(result.reason), "error");
      return;
    }

    notify(ctx, `Renamed session: ${result.names.sessionName}`, "info");
  };

  // ── Commands ─────────────────────────────────────────────────────────────

  pi.registerCommand("rename", {
    description: "Rename the current session from user and assistant messages in this branch",
    handler: renameFromBranch,
  });

  // ── Events ───────────────────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    resetSessionState();
    await restoreExistingSessionName(ctx);
  });

  pi.on("session_switch", async (_event, ctx) => {
    resetSessionState();
    await restoreExistingSessionName(ctx);
  });

  pi.on("before_agent_start", async (event, ctx) => {
    resolveProject(ctx);
    const firstPrompt = getFirstUserPrompt(ctx.sessionManager.getBranch()) ?? event.prompt;

    if (ctx.hasUI) {
      void applyAutoName(firstPrompt, ctx);
      return;
    }

    await applyAutoName(firstPrompt, ctx);
  });

  pi.on("session_shutdown", async (_event, _ctx) => {
    // Reset tmux window title to bare project name (no π prefix, no topic)
    if (currentProject) {
      await renameTmuxWindow(pi, currentProject);
    }
  });
}
