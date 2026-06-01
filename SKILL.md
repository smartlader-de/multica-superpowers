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
8. Create or update the agents listed in the manifest.
9. Attach each imported skill to its matching agent.
10. Apply the rendered wrapper instructions from `multica-installer/agents/`.
11. Post a setup summary with all created or updated skills and agents.

## Rules

- Do not modify upstream Superpowers skill content.
- Do not vendor upstream Superpowers skills into this repository.
- Do not create duplicate agents or skills when a managed object already exists.
- If an existing object has unclear ownership, stop and ask the human before replacing it.
- At human gates, mention the configured human reviewer and stop. Do not mention the next agent until the human approves.
- On blockers, set or request `blocked` status, explain the blocker, mention the human reviewer, and stop.

## Validation

Before claiming setup files are ready, run:

```bash
node multica-installer/scripts/render-agent-instructions.mjs
node multica-installer/scripts/validate-manifest.mjs
node multica-installer/scripts/render-dry-run.mjs
```
