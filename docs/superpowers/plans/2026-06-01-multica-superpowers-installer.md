# Multica Superpowers Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Multica installer skill that fetches upstream Superpowers at setup time, creates one Multica agent per Superpowers skill, and applies Multica-specific handoff and human-gate wrapper instructions.

**Architecture:** The repository root gets only `SKILL.md`; all implementation support lives under `multica-installer/`. `manifest.json` is the source of truth for upstream Superpowers source, agent mappings, handoffs, and gates. Small Node scripts validate the manifest, render agent instruction files, and print a dry-run setup summary without touching a Multica workspace.

**Tech Stack:** Markdown skill files, JSON manifest, Node.js ES modules using only built-in modules.

---

## File Structure

- Create `SKILL.md`: Multica-importable installer entrypoint.
- Create `multica-installer/README.md`: setup, dry-run, and recovery notes.
- Create `multica-installer/manifest.json`: upstream source, agents, handoffs, gates, and runtime policy.
- Create `multica-installer/templates/agent-wrapper.md`: reusable wrapper template.
- Create `multica-installer/templates/human-gate.md`: reusable human gate wording.
- Create `multica-installer/templates/setup-summary.md`: setup summary template.
- Create `multica-installer/scripts/render-agent-instructions.mjs`: renders `multica-installer/agents/*.md` from manifest and template.
- Create `multica-installer/scripts/validate-manifest.mjs`: validates source, agents, handoffs, gates, and rendered files.
- Create `multica-installer/scripts/render-dry-run.mjs`: prints intended Multica setup operations.
- Create generated `multica-installer/agents/*.md`: one wrapper instruction file per agent.

## Task 1: Add Root Installer Skill

**Files:**
- Create: `SKILL.md`

- [ ] **Step 1: Write the failing validation command**

Run:

```bash
test -f SKILL.md && sed -n '1,80p' SKILL.md
```

Expected: FAIL because `SKILL.md` does not exist yet.

- [ ] **Step 2: Create `SKILL.md`**

Create `SKILL.md` with this content:

````markdown
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
````

- [ ] **Step 3: Verify the skill file**

Run:

```bash
test -f SKILL.md && sed -n '1,80p' SKILL.md
```

Expected: PASS and output begins with `name: multica-superpowers`.

- [ ] **Step 4: Commit**

```bash
git add SKILL.md
git commit -m "Add Multica Superpowers installer skill"
```

## Task 2: Add Installer Manifest

**Files:**
- Create: `multica-installer/manifest.json`
- Create: `multica-installer/README.md`

- [ ] **Step 1: Write the failing validation command**

Run:

```bash
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('multica-installer/manifest.json','utf8'))"
```

Expected: FAIL with `ENOENT`.

- [ ] **Step 2: Create `multica-installer/manifest.json`**

Create the directory and file with this exact JSON:

```json
{
  "schema_version": 1,
  "installer": {
    "name": "multica-superpowers",
    "runtime_policy": "use-installer-runtime-and-model",
    "managed_by_label": "multica-superpowers-installer"
  },
  "superpowers_source": {
    "type": "github",
    "repo": "obra/superpowers",
    "ref": "v5.1.0",
    "skills_path": "skills"
  },
  "human_reviewer": {
    "mode": "ask-during-setup",
    "placeholder": "@human-reviewer"
  },
  "agents": [
    {
      "slug": "using-superpowers",
      "skill": "using-superpowers",
      "description": "Bootstrap agent that enforces Superpowers skill discovery and routing.",
      "next": "brainstorming",
      "gates": []
    },
    {
      "slug": "brainstorming",
      "skill": "brainstorming",
      "description": "Turns rough ideas into approved design specs before implementation.",
      "next": "writing-plans",
      "gates": ["spec-review"]
    },
    {
      "slug": "using-git-worktrees",
      "skill": "using-git-worktrees",
      "description": "Ensures isolated development workspace before implementation work.",
      "next": "executing-plans",
      "gates": []
    },
    {
      "slug": "writing-plans",
      "skill": "writing-plans",
      "description": "Writes bite-sized implementation plans from approved specs.",
      "next": "using-git-worktrees",
      "gates": ["plan-review"]
    },
    {
      "slug": "executing-plans",
      "skill": "executing-plans",
      "description": "Executes written implementation plans with checkpoints.",
      "next": "requesting-code-review",
      "gates": []
    },
    {
      "slug": "subagent-driven-development",
      "skill": "subagent-driven-development",
      "description": "Executes implementation plans with fresh subagents and review loops.",
      "next": "requesting-code-review",
      "gates": []
    },
    {
      "slug": "dispatching-parallel-agents",
      "skill": "dispatching-parallel-agents",
      "description": "Coordinates independent parallel agent tasks.",
      "next": "requesting-code-review",
      "gates": []
    },
    {
      "slug": "test-driven-development",
      "skill": "test-driven-development",
      "description": "Enforces red-green-refactor implementation.",
      "next": "verification-before-completion",
      "gates": []
    },
    {
      "slug": "systematic-debugging",
      "skill": "systematic-debugging",
      "description": "Finds root cause before attempting fixes.",
      "next": "test-driven-development",
      "gates": []
    },
    {
      "slug": "requesting-code-review",
      "skill": "requesting-code-review",
      "description": "Requests focused code review before completion or merge.",
      "next": "verification-before-completion",
      "gates": []
    },
    {
      "slug": "receiving-code-review",
      "skill": "receiving-code-review",
      "description": "Evaluates and responds to review feedback rigorously.",
      "next": "verification-before-completion",
      "gates": []
    },
    {
      "slug": "verification-before-completion",
      "skill": "verification-before-completion",
      "description": "Requires evidence before claiming work is complete.",
      "next": "finishing-a-development-branch",
      "gates": []
    },
    {
      "slug": "finishing-a-development-branch",
      "skill": "finishing-a-development-branch",
      "description": "Guides final merge, PR, keep, or cleanup decisions.",
      "next": null,
      "gates": ["completion-decision"]
    },
    {
      "slug": "writing-skills",
      "skill": "writing-skills",
      "description": "Creates or edits skills with evaluation discipline.",
      "next": "requesting-code-review",
      "gates": []
    }
  ],
  "human_gates": {
    "spec-review": {
      "status": "in_review",
      "message": "Spec is ready for review. Please review the artifact, then approve by mentioning @writing-plans."
    },
    "plan-review": {
      "status": "in_review",
      "message": "Implementation plan is ready for review. Please review it, then approve by mentioning @using-git-worktrees."
    },
    "completion-decision": {
      "status": "in_review",
      "message": "Implementation is complete. Please choose merge, PR, keep branch, or cleanup."
    },
    "blocked": {
      "status": "blocked",
      "message": "Work is blocked and needs human input before another agent is invoked."
    }
  }
}
```

- [ ] **Step 3: Create `multica-installer/README.md`**

Create this content:

````markdown
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
````

- [ ] **Step 4: Verify JSON parses**

Run:

```bash
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('multica-installer/manifest.json','utf8')); console.log(data.agents.length)"
```

Expected: `14`.

- [ ] **Step 5: Commit**

```bash
git add multica-installer/manifest.json multica-installer/README.md
git commit -m "Add Multica installer manifest"
```

## Task 3: Add Templates and Renderer

**Files:**
- Create: `multica-installer/templates/agent-wrapper.md`
- Create: `multica-installer/templates/human-gate.md`
- Create: `multica-installer/templates/setup-summary.md`
- Create: `multica-installer/scripts/render-agent-instructions.mjs`
- Generate: `multica-installer/agents/*.md`

- [ ] **Step 1: Write the failing render command**

Run:

```bash
node multica-installer/scripts/render-agent-instructions.mjs
```

Expected: FAIL with `MODULE_NOT_FOUND`.

- [ ] **Step 2: Create `multica-installer/templates/agent-wrapper.md`**

```markdown
# {{slug}} Agent

You are the Multica agent for the upstream Superpowers skill `{{skill}}`.

## Authoritative Skill

Use the imported upstream Superpowers skill `{{skill}}` as the source of truth for how to do the work. Do not rewrite, summarize away, or weaken that skill's process.

## Multica Handoff Rules

- Work only on the phase covered by `{{skill}}`.
{{completion_rule}}
- If blocked, set or request status `blocked`, explain the blocker, mention `{{human_reviewer}}`, and stop.
- Never mention yourself.

## Human Gate Message

{{gate_message}}
```

- [ ] **Step 3: Create `multica-installer/templates/human-gate.md`**

````markdown
When human approval is required, post:

```text
{{gate_message}}

Reviewer: {{human_reviewer}}
Next agent after approval: @{{next}}
```

Then stop. The human must resume by mentioning the next agent.
````

- [ ] **Step 4: Create `multica-installer/templates/setup-summary.md`**

```markdown
# Multica Superpowers Setup Summary

Managed by: `multica-superpowers-installer`

Upstream source: `{{repo}}` at `{{ref}}`

Created or updated agents:

{{agents}}

Start normal work by mentioning `@using-superpowers` or by assigning a new issue to that agent.
```

- [ ] **Step 5: Create `multica-installer/scripts/render-agent-instructions.mjs`**

```javascript
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "manifest.json");
const templatePath = path.join(root, "templates", "agent-wrapper.md");
const outputDir = path.join(root, "agents");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const template = fs.readFileSync(templatePath, "utf8");

fs.mkdirSync(outputDir, { recursive: true });

function render(templateText, replacements) {
  return templateText.replace(/\{\{([a-z_]+)\}\}/g, (match, key) => {
    if (!(key in replacements)) {
      throw new Error(`Missing template replacement: ${key}`);
    }
    return replacements[key];
  });
}

for (const agent of manifest.agents) {
  const firstGateName = agent.gates[0] ?? null;
  const gate = firstGateName ? manifest.human_gates[firstGateName] : null;
  const next = agent.next ?? "human-reviewer";
  const completionRule = gate
    ? `- When this phase reaches its human gate, set or request status \`${gate.status}\`, mention \`${manifest.human_reviewer.placeholder}\`, and stop without mentioning the next agent.`
    : `- If this phase completes successfully, post a concise completion comment and mention \`@${next}\`.`;
  const content = render(template, {
    slug: agent.slug,
    skill: agent.skill,
    next,
    human_reviewer: manifest.human_reviewer.placeholder,
    gate_status: gate?.status ?? "none",
    gate_message: gate?.message ?? "No human gate applies for this phase.",
    completion_rule: completionRule
  });

  fs.writeFileSync(path.join(outputDir, `${agent.slug}.md`), `${content.trim()}\n`);
}

console.log(`Rendered ${manifest.agents.length} agent instruction files.`);
```

- [ ] **Step 6: Run renderer**

Run:

```bash
node multica-installer/scripts/render-agent-instructions.mjs
```

Expected: `Rendered 14 agent instruction files.`

- [ ] **Step 7: Verify generated file count**

Run:

```bash
find multica-installer/agents -name '*.md' | wc -l | tr -d ' '
```

Expected: `14`.

- [ ] **Step 8: Commit**

```bash
git add multica-installer/templates multica-installer/scripts/render-agent-instructions.mjs multica-installer/agents
git commit -m "Render Multica agent wrapper instructions"
```

## Task 4: Add Manifest Validation

**Files:**
- Create: `multica-installer/scripts/validate-manifest.mjs`

- [ ] **Step 1: Write the failing validation command**

Run:

```bash
node multica-installer/scripts/validate-manifest.mjs
```

Expected: FAIL with `MODULE_NOT_FOUND`.

- [ ] **Step 2: Create `multica-installer/scripts/validate-manifest.mjs`**

```javascript
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const agentsDir = path.join(root, "agents");

const expectedSkills = [
  "using-superpowers",
  "brainstorming",
  "using-git-worktrees",
  "writing-plans",
  "executing-plans",
  "subagent-driven-development",
  "dispatching-parallel-agents",
  "test-driven-development",
  "systematic-debugging",
  "requesting-code-review",
  "receiving-code-review",
  "verification-before-completion",
  "finishing-a-development-branch",
  "writing-skills"
];

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

if (manifest.superpowers_source.repo !== "obra/superpowers") {
  fail("superpowers_source.repo must be obra/superpowers");
}

if (!manifest.superpowers_source.ref) {
  fail("superpowers_source.ref must be pinned");
}

const slugs = new Set();
const skills = new Set();

for (const agent of manifest.agents ?? []) {
  if (!agent.slug || !agent.skill) {
    fail(`agent is missing slug or skill: ${JSON.stringify(agent)}`);
    continue;
  }

  if (slugs.has(agent.slug)) {
    fail(`duplicate agent slug: ${agent.slug}`);
  }
  slugs.add(agent.slug);

  if (skills.has(agent.skill)) {
    fail(`duplicate skill mapping: ${agent.skill}`);
  }
  skills.add(agent.skill);

  if (agent.next && !manifest.agents.some((candidate) => candidate.slug === agent.next)) {
    fail(`${agent.slug} next points to unknown agent ${agent.next}`);
  }

  for (const gateName of agent.gates ?? []) {
    if (!manifest.human_gates[gateName]) {
      fail(`${agent.slug} references unknown gate ${gateName}`);
    }
  }

  const renderedPath = path.join(agentsDir, `${agent.slug}.md`);
  if (!fs.existsSync(renderedPath)) {
    fail(`missing rendered agent instructions: ${renderedPath}`);
  } else {
    const rendered = fs.readFileSync(renderedPath, "utf8");
    if (!rendered.includes(`upstream Superpowers skill \`${agent.skill}\``)) {
      fail(`${agent.slug} instructions do not reference expected skill ${agent.skill}`);
    }
    if ((agent.gates ?? []).length > 0 && rendered.includes(`mention \`@${agent.next}\``)) {
      fail(`${agent.slug} gate instructions should not auto-mention @${agent.next}`);
    }
  }
}

for (const expectedSkill of expectedSkills) {
  if (!skills.has(expectedSkill)) {
    fail(`missing expected skill mapping: ${expectedSkill}`);
  }
}

if (manifest.agents.length !== expectedSkills.length) {
  fail(`expected ${expectedSkills.length} agents, found ${manifest.agents.length}`);
}

if (!process.exitCode) {
  console.log(`Manifest valid: ${manifest.agents.length} agents mapped to ${skills.size} skills.`);
}
```

- [ ] **Step 3: Run renderer then validator**

Run:

```bash
node multica-installer/scripts/render-agent-instructions.mjs
node multica-installer/scripts/validate-manifest.mjs
```

Expected:

```text
Rendered 14 agent instruction files.
Manifest valid: 14 agents mapped to 14 skills.
```

- [ ] **Step 4: Commit**

```bash
git add multica-installer/scripts/validate-manifest.mjs multica-installer/agents
git commit -m "Validate Multica installer manifest"
```

## Task 5: Add Dry-Run Renderer

**Files:**
- Create: `multica-installer/scripts/render-dry-run.mjs`

- [ ] **Step 1: Write the failing dry-run command**

Run:

```bash
node multica-installer/scripts/render-dry-run.mjs
```

Expected: FAIL with `MODULE_NOT_FOUND`.

- [ ] **Step 2: Create `multica-installer/scripts/render-dry-run.mjs`**

```javascript
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

console.log("# Multica Superpowers dry run");
console.log("");
console.log(`Upstream: ${manifest.superpowers_source.repo}@${manifest.superpowers_source.ref}`);
console.log(`Skills path: ${manifest.superpowers_source.skills_path}`);
console.log(`Runtime policy: ${manifest.installer.runtime_policy}`);
console.log(`Human reviewer: ${manifest.human_reviewer.placeholder} (ask during setup)`);
console.log("");

for (const agent of manifest.agents) {
  const source = `https://github.com/${manifest.superpowers_source.repo}/tree/${manifest.superpowers_source.ref}/${manifest.superpowers_source.skills_path}/${agent.skill}`;
  console.log(`## ${agent.slug}`);
  console.log(`- Import skill: ${source}`);
  console.log(`- Create/update agent: ${agent.slug}`);
  console.log(`- Attach skill: ${agent.skill}`);
  console.log(`- Apply instructions: multica-installer/agents/${agent.slug}.md`);
  console.log(`- Next: ${agent.next ? `@${agent.next}` : "human completion decision"}`);
  console.log(`- Gates: ${agent.gates.length > 0 ? agent.gates.join(", ") : "none"}`);
  console.log("");
}
```

- [ ] **Step 3: Run dry run**

Run:

```bash
node multica-installer/scripts/render-dry-run.mjs | sed -n '1,80p'
```

Expected: output starts with `# Multica Superpowers dry run` and includes `## using-superpowers` and `## brainstorming`.

- [ ] **Step 4: Commit**

```bash
git add multica-installer/scripts/render-dry-run.mjs
git commit -m "Add Multica installer dry run"
```

## Task 6: Verify End-to-End Local Artifacts

**Files:**
- Modify only if previous tasks reveal a validation issue.

- [ ] **Step 1: Run full local validation**

Run:

```bash
node multica-installer/scripts/render-agent-instructions.mjs
node multica-installer/scripts/validate-manifest.mjs
node multica-installer/scripts/render-dry-run.mjs > /tmp/multica-superpowers-dry-run.txt
test "$(find multica-installer/agents -name '*.md' | wc -l | tr -d ' ')" = "14"
```

Expected:

```text
Rendered 14 agent instruction files.
Manifest valid: 14 agents mapped to 14 skills.
```

The final `test` command should exit with status `0`.

- [ ] **Step 2: Check root footprint**

Run:

```bash
git status --short
find . -maxdepth 1 -type f -name 'SKILL.md' -o -type d -name 'multica-installer'
```

Expected: only planned files are changed, and root additions are limited to `SKILL.md` plus `multica-installer/`.

- [ ] **Step 3: Review dry-run output**

Run:

```bash
sed -n '1,120p' /tmp/multica-superpowers-dry-run.txt
```

Expected: every agent lists an upstream GitHub source, create/update agent action, attach skill action, instruction path, next handoff, and gates.

- [ ] **Step 4: Final commit if any validation fixes were required**

If Step 1 or Step 2 required edits, commit them:

```bash
git add SKILL.md multica-installer
git commit -m "Verify Multica Superpowers installer artifacts"
```

If no files changed, do not create an empty commit.

## Self-Review Checklist

- The root contains only `SKILL.md` as a new root file.
- All Multica-specific support files live under `multica-installer/`.
- No upstream Superpowers `skills/` files were modified.
- No upstream Superpowers skill content was vendored.
- `manifest.json` maps exactly 14 agents to exactly 14 upstream skills.
- Human gates stop and mention the reviewer placeholder instead of auto-mentioning the next agent.
- Dry-run output is useful without mutating a Multica workspace.
