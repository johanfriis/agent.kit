# git-hunk essentials

Quick reference for `git-hunk` — the staging tool used by the commit skill.
Installed on PATH as `git hunk <subcommand>`.

## Commands

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `list` | Enumerate hunks with hashes | `--staged`, `--file`, `--porcelain`, `--oneline`, `--unified` |
| `diff` | Inspect full diff of specific hunks | `--staged`, `--file`, `--porcelain` |
| `add` | Stage hunks by hash | `--all`, `--file`, line specs (`sha:3-5,8`) |
| `reset` | Unstage hunks by hash | `--all`, `--file`, line specs |
| `commit` | Commit specific hunks directly | `-m <msg>`, `--all`, `--file`, `--amend`, `--dry-run` |
| `stash` | Save hunks to git stash | `--all`, `-u`, `--file`, `-m <msg>`, `pop` |
| `restore` | Revert worktree hunks (destructive) | `--all`, `--file`, `--force`, `--dry-run` |
| `count` | Bare integer hunk count | `--staged`, `--file` |
| `check` | Verify hashes still valid | `--staged`, `--exclusive`, `--allow-empty` |

## Global flags

All commands accept: `--help`, `--no-color`, `--tracked-only`, `--untracked-only`,
`--quiet`/`-q`, `--verbose`/`-v`, and `-U<n>`/`--unified=<n>`.

SHA prefixes need at least 4 hex characters. Use `--file` to disambiguate
prefix collisions.

## Hash stability

Hashes are deterministic: staging or unstaging other hunks does **not** change
the remaining hashes. List once, then stage multiple hunks sequentially.

The hash is computed from: file path, stable line number (worktree side for
unstaged, HEAD side for staged), and diff content (`+`/`-` lines only). Staged
and unstaged hashes for the same hunk differ — use `add`'s `→` output to track
the mapping.

## New, deleted, and untracked files

- Untracked files appear automatically in `list` output. Use `--tracked-only`
  or `--untracked-only` to filter.
- Deleted files appear automatically when a tracked file is removed.
- `git add -N <file>` (intent-to-add) is optional — untracked files are listed
  without it.

## Common errors

All errors go to stderr. Exit 0 on success, 1 on error.

| Error | Cause |
|-------|-------|
| `error: no hunk matching '<sha>'` | Hash not found |
| `error: ambiguous prefix '<sha>'` | Use longer prefix or `--file` |
| `error: patch did not apply cleanly` | Re-run `list` and try again |
| `no unstaged changes` / `no staged changes` | Nothing to operate on |
| `error: <sha> (<file>) is an untracked file -- use --force to delete` | `restore` requires `--force` for untracked files |

## Further reference

- [Command reference](commands.md) — all commands, flags, arguments, behavior, and error tables
- [Output format](output.md) — human and porcelain output details
- [Scripting patterns](scripting.md) — porcelain parsing, pipeline recipes
- [Ref support](ref-support.md) — `--ref <refspec>` for diffing against branches, commits, and ranges
