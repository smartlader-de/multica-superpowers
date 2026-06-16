---
name: multica-superpowers
description: Use when setting up Superpowers in a Multica workspace - installs Multica agents for each upstream Superpowers skill, configures handoffs, and sets human review gates
---

# Multica Superpowers Installer

Use this skill when the human asks to set up Superpowers in a Multica workspace.

## Purpose

This is an installer and repair skill. It does not replace upstream Superpowers skills. It imports or fetches the official upstream Superpowers skills, creates one Multica agent per skill, and adds Multica-specific wrapper instructions for `@agent` handoffs and human review gates.

## Setup Workflow

When asked to set up the workspace:

1. Confirm you are running in a Multica workspace task.
2. Confirm the Multica CLI or API is available.
3. Load `multica-installer/manifest.json`.
4. Determine the runtime and model used by this installer. In V1, generated agents use the same runtime and model.
5. Ask for the human reviewer mention if it is not already known.
6. Run or explain the dry run:

   ```bash
   node multica-installer/scripts/render-dry-run.mjs
   ```

7. Import or create the workspace skills listed in the manifest from the pinned upstream Superpowers source.
8. Create or update the agents listed in the manifest, using the manifest agent defaults. In V1, set `max_concurrent_tasks` to `1` so Multica does not parallelize issue work unless the human explicitly changes that later.
9. Attach each imported skill to its matching agent.
10. Apply the rendered wrapper instructions from `multica-installer/agents/`.
11. Post a setup summary with all created or updated skills and agents.
12. If setup completed successfully, mark the setup issue `done`.

## Multica CLI Notes

The local Multica CLI commands known to work for this installer are:

```bash
multica user profile get --output json
multica workspace get --output json
multica workspace member list --output json
multica skill import --url <github-skill-url> --output json
multica agent create --name <name> --runtime-id <runtime-id> --model <model> --max-concurrent-tasks 1 --instructions <instructions> --output json
multica agent update <agent-id> --runtime-id <runtime-id> --model <model> --max-concurrent-tasks 1 --instructions <instructions> --output json
multica agent skills set <agent-id> --skill-ids <skill-id> --output json
multica issue status <issue-id> done
```

Use `multica user profile get --output json`; `multica user profile --output json` is not a valid command.

## Mention Link Handling

Multica may store rich mentions as markdown links such as `[@agent](mention://agent/<id>)`. Handle those links in two phases:

1. Render wrapper instructions with safe placeholders from this repo first.
2. After all agents exist and the human reviewer is known, replace only the literal placeholders or raw agent names with final Multica mention links.
3. Do not run global replacement over text that already contains `mention://` links.
4. Verify the final agent instructions have no nested mention markdown, no raw `@human-reviewer`, and the expected next-agent or human-review links are present.

The mention `type` must match the entity, or the link resolves to nothing:

- Next-agent handoffs use `mention://agent/<agent-id>` (looked up with `multica agent list --output json`). An `agent` mention enqueues that agent's run.
- The human reviewer is a workspace member, so it must use `mention://member/<user-id>` (looked up with `multica workspace member list --output json`; use `user_id`, not the membership-row id). A `member` mention renders a link but enqueues no run — the status change to `in_review` is what surfaces the gate. Do not give the human reviewer an `agent`-type link.

## Built-in Multica Skills

The generated agent instructions defer collaboration mechanics to Multica's built-in skills rather than re-explaining them. Confirm these built-in skills are available in the workspace; the agents reference them by name:

- `multica-mentioning` — the verified mention-link contract (link shape, UUID lookup, which mention types enqueue a run).
- `multica-working-on-issues` — issue status side effects, PR linking vs close intent, sub-issue enqueue behavior, and metadata keys.

## Rules

- Do not modify upstream Superpowers skill content.
- Do not vendor upstream Superpowers skills into this repository.
- Do not create duplicate agents or skills when a managed object already exists.
- If an existing object has unclear ownership, stop and ask the human before replacing it.
- At human gates, mention the configured human reviewer and stop. Do not mention the next agent until the human approves.
- On blockers, set or request `blocked` status, explain the blocker, mention the human reviewer, and stop.
- Keep generated agents sequential by default with `max_concurrent_tasks=1`; child issues are checkpoints unless the human explicitly approves parallel work.
- Do not mark the setup issue `done` until skill import, agent creation or update, skill attachment, wrapper instruction application, and setup summary posting have all succeeded.

## Validation

Before claiming setup files are ready, run:

```bash
node multica-installer/scripts/render-agent-instructions.mjs
node multica-installer/scripts/validate-manifest.mjs
node multica-installer/scripts/render-dry-run.mjs
```
