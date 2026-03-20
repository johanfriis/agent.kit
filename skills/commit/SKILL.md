---
name: commit
description: |
  End-to-end git commit workflow: staging, reviewing, committing, and pushing.
  ALWAYS use `git hunk` commands instead of `git add` for staging changes.
  Use when:
  - Staging changes (`git hunk add` instead of `git add`)
  - Reviewing, diffing, or inspecting changes before committing
  - Selectively staging or unstaging specific hunks
  - Splitting changes across multiple atomic commits
  - Making commits with conventional commit messages
  - Amending recent commits
  - Pushing commits or pulling with rebase
  - Stashing or restoring specific hunks
  - Any git workflow involving stage, unstage, commit, push, pull, diff, stash, or revert
  Triggers: "git add", "stage", "staging", "commit", "push", "pull", "prepare commit",
  "selective commit", "partial commit", "split commit", "review changes", "what changed",
  "diff", "unstage", "stash", "discard changes", "revert changes", "amend", "force push"
---

# Commit Skill

Owns the full commit lifecycle: review changes, stage hunks, write conventional
commit messages, push to remote. Built on `git-hunk` for deterministic,
hunk-level staging.

---

## 1. Staging with git-hunk

**NEVER use `git add` — always use `git hunk` commands for staging.**

`git add <file>` stages entire files including unreviewed changes.
`git hunk add <hash>` stages individual hunks, ensuring every staged line is reviewed.

### Happy path

```bash
git hunk list                    # review all changes (with diffs)
git hunk diff a3f7c21            # inspect a specific hunk
git hunk add a3f7c21             # stage it
git hunk add b82e0f4             # stage another (hashes are stable)
git hunk list --staged           # verify what's staged
git commit -m "feat(parser): add error handling"
```

To stage everything at once: `git hunk add --all`

### Common operations

| What | How |
|------|-----|
| Review changes | `git hunk list` |
| Inspect a hunk | `git hunk diff <sha>` |
| Stage a hunk | `git hunk add <sha>` |
| Stage all | `git hunk add --all` |
| Unstage a hunk | `git hunk reset <sha>` (uses hashes from `list --staged`) |
| Discard a change | `git hunk restore <sha>` (destructive) |

### Pre-existing staged changes

If `git hunk list --staged` shows changes you didn't stage, **ask the user**
what to do — don't silently include or reset them.

### More git-hunk details

For the full command set, flags, hash behavior, error handling, and scripting:
see [git-hunk essentials](references/essentials.md) and the detailed
[command reference](references/commands.md).

---

## 2. Commit message convention

Strict [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/#summary):

```
type(scope): description
```

**Types:** `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`,
`build`, `ci`, `revert`

**Rules:**
- Subject line: concise, imperative mood, no period
- Scope: optional, lowercase (e.g., `feat(parser): ...`)
- Body: add when the "why" isn't obvious from the subject
- Breaking changes: `!` after type/scope (e.g., `feat(api)!: remove v1`),
  or `BREAKING CHANGE:` footer

---

## 3. Amend heuristic

Prefer `git commit --amend` over a new commit when **both** are true:

1. The HEAD commit was made **in the current agent session**
2. The new changes are a continuation or fix of that same logical change

Otherwise, create a new commit. When amending, update the message only if the
scope of the change has meaningfully expanded.

---

## 4. Push behavior

**Default: push after every commit** unless another commit is about to follow
immediately or the user has said not to push.

Before pushing, always pull:

```bash
git pull --rebase
```

If the pull introduces **merge conflicts**: abort (`git rebase --abort`), inform
the user, and let them decide. Never leave the repo in a mid-rebase state.

### Post-commit summary

After every commit (and push if applicable), show the user a summary
using the `callout` tool. Use the commit message and the output from
`git commit` (which includes the SHA and shortstat). Title should be
"Commit <short-sha>". No need to run `git log` — you already have
everything.

---

## 5. Force push rules

**Auto force-push** with `--force-with-lease` — allowed ONLY when:
- Amending a commit that was pushed **in this session**, AND
- No `git pull` or `git fetch` has happened since that push

All other force-push situations: **ask the user for confirmation.**

---

## 6. Atomic commit grouping

When changes span multiple logical units:

1. Propose the grouping — list each commit with its hunks and message
2. Wait for approval or adjustments
3. Execute in order, pushing after the final one

When it's a simple, single-purpose change — just commit and push. Don't
over-split trivial changes.
