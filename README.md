# Multica Superpowers

Standalone Multica installer skill for Superpowers.

This repository is not a fork or mirror of upstream Superpowers. It is a thin
Multica installer that imports the official Superpowers skills from:

```text
obra/superpowers@v5.1.0
```

The repo stays intentionally small so it can be imported by Multica without
exceeding the import bundle file limit.

## What This Installs

After importing `multica-superpowers` into a Multica workspace and asking it to
set up the workspace, the installer should create:

- 14 workspace skills imported from `obra/superpowers@v5.1.0`
- 14 matching Multica agents, one per Superpowers skill
- Wrapper instructions for Multica `@agent` handoffs
- Human review gates for spec review, plan review, blockers, and completion

The installer itself is separate from those working agents.

## Repository Layout

```text
SKILL.md
multica-installer/
  manifest.json
  agents/
  templates/
  scripts/
```

- `SKILL.md` is the Multica-importable installer entrypoint.
- `multica-installer/manifest.json` pins the upstream source and agent mapping.
- `multica-installer/agents/*.md` are generated Multica wrapper instructions.
- `multica-installer/templates/*.md` are the wrapper templates.
- `multica-installer/scripts/*.mjs` render, validate, and preview setup.

## What Is Not Here

This repo does not vendor upstream Superpowers skill bodies. There is no local
copy of upstream `skills/`, tests, harness plugins, release notes, or docs. The
installer imports the Superpowers skill content from the pinned upstream GitHub
source during setup.

## Validate Locally

Run these commands from the repo root:

```bash
node multica-installer/scripts/render-agent-instructions.mjs
node multica-installer/scripts/validate-manifest.mjs
node multica-installer/scripts/render-dry-run.mjs
```

Expected:

```text
Rendered 14 agent instruction files.
Manifest valid: 14 agents mapped to 14 skills.
```

To confirm the import bundle stays small:

```bash
git ls-files | wc -l
```

Expected: fewer than 128 tracked files.

## Multica Setup Check

A successful workspace setup should show:

- `multica-superpowers` installer skill present
- 14 Superpowers skills imported from `obra/superpowers@v5.1.0`
- 14 generated agents with matching names
- each generated agent has exactly one matching skill attached
- generated agents use the installer runtime/model for V1
- human gates mention a real workspace member

Useful inspection commands:

```bash
multica --profile <profile> workspace list
multica --profile <profile> --workspace-id <workspace-id> skill list --output json
multica --profile <profile> --workspace-id <workspace-id> agent list --output json
multica --profile <profile> --workspace-id <workspace-id> issue list --limit 50 --output json
```

## Acceptance Test

Provisioning is not the same as workflow acceptance. After setup, create a fresh
issue assigned to `using-superpowers` with:

```text
Let's make a react todo list
```

Expected behavior:

1. `using-superpowers` routes the work to `brainstorming`.
2. `brainstorming` runs before implementation.
3. `brainstorming` stops at the human spec review gate.
4. The human resumes by approving and mentioning the next agent.

## Current Scope

V1 uses one runtime/model for every generated agent: the same runtime/model used
by the installer. Per-agent runtime selection, automatic repo attachment, and a
full end-to-end workflow test are intentionally left outside this installer
bundle.
