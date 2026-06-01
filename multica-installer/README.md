# Multica Installer

This folder contains the Multica-specific installer support files for the root `multica-superpowers` skill.

The installer does not vendor Superpowers skill content. It fetches or imports upstream Superpowers from the pinned source in `manifest.json`, then creates Multica workspace skills and agents with wrapper instructions for handoffs and human gates.

## Validate

```bash
node multica-installer/scripts/render-agent-instructions.mjs
node multica-installer/scripts/validate-manifest.mjs
node multica-installer/scripts/render-dry-run.mjs
```

## Runtime Policy

V1 uses the same runtime and model as the installer agent for all generated agents.

## Human Reviewer

The installer asks for a human reviewer mention during setup unless Multica exposes an unambiguous current member mention.
