# Multica Superpowers

Standalone Multica installer skill for Superpowers.

This repository intentionally does not mirror or vendor the upstream Superpowers
skills. The installer references the official upstream source:

```text
obra/superpowers@v5.1.0
```

When imported into Multica, `SKILL.md` acts as the installer entrypoint. The
files under `multica-installer/` describe which upstream Superpowers skills to
import, which Multica agents to create, and how those agents should hand off to
each other or stop for human review gates.

## Validate

```bash
node multica-installer/scripts/render-agent-instructions.mjs
node multica-installer/scripts/validate-manifest.mjs
node multica-installer/scripts/render-dry-run.mjs
```

## File Count

This repo is kept below Multica's import bundle file limit by tracking only the
installer skill and Multica-specific support files.
