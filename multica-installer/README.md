# Multica Installer

This folder contains the Multica-specific installer support files for the root `multica-superpowers` skill.

The installer does not vendor Superpowers skill content. It fetches or imports upstream Superpowers from the pinned source in `manifest.json`, then creates Multica workspace skills and agents with wrapper instructions for handoffs and human gates.

## Installer Workflow

The installer uses a two-mode plan-then-execute approach that eliminates shell fragility (no heredocs, no backgrounding, no `--instructions-file`):

```bash
# Step 1: discover workspace state and write install-plan.json
node multica-installer/scripts/install.mjs --plan

# Step 2: review install-plan.json (resolve any ambiguous[] entries)

# Step 3: execute deterministically from the plan
node multica-installer/scripts/install.mjs --apply
# or with an explicit path:
node multica-installer/scripts/install.mjs --apply /path/to/install-plan.json
```

Set `MULTICA_ISSUE_ID=<id>` in the environment before running `--apply` to enable issue status updates and summary posting.

## `install-plan.json` Contract

`install-plan.json` is the data artifact separating plan from execution. It is **git-ignored** (contains workspace-specific IDs). The schema is:

```json
{
  "schema_version": 1,
  "runtime_id": "<runtime-uuid>",
  "model": "<model-name>",
  "workspace_id": "<workspace-uuid>",
  "issue_id": "<issue-uuid or null>",
  "reviewer": { "type": "member", "userId": "<user-uuid>", "mention": "@human-reviewer" },
  "agents": [{ "slug": "brainstorming", "action": "create|update|skip", "agentId": null }],
  "skills": [{ "name": "brainstorming", "action": "create|update|skip", "skillId": null }],
  "mentions": {
    "@writing-plans": { "type": "agent", "targetSlug": "writing-plans" },
    "@human-reviewer": { "type": "member", "userId": "<user-uuid>" }
  },
  "ambiguous": []
}
```

`--apply` refuses to run while `ambiguous[]` is non-empty. Resolve ambiguities by editing the file directly (e.g. set the reviewer `userId` from the `candidates` list) and re-running `--apply`.

Only IDs discovered at plan time appear in the file — the executor never re-decides `create` vs `update`.

## Validate

```bash
node multica-installer/scripts/render-agent-instructions.mjs
node multica-installer/scripts/validate-manifest.mjs
node multica-installer/scripts/render-dry-run.mjs
node multica-installer/scripts/install.mjs --plan   # dry-run discovery; writes install-plan.json
```

## Runtime Policy

V1 uses the same runtime and model as the installer agent for all generated agents.

## Human Reviewer

The installer resolves the human reviewer from workspace members during `--plan`. If the workspace has exactly one member, the reviewer is resolved automatically. If multiple members exist, the `ambiguous[]` array lists candidates with their `userId` values — edit `install-plan.json` to set the correct one before running `--apply`.
