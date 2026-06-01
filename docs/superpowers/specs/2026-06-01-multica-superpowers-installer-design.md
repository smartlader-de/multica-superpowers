# Multica Superpowers Installer Design

## Problem

Multica users need a standalone skill they can import into a workspace and ask to set up Superpowers. The setup should create a Multica-native team of agents, one agent per Superpowers skill, without modifying or vendoring the upstream Superpowers repository content in this project.

The desired user flow is:

1. Import the standalone `multica-superpowers` skill into Multica.
2. Ask the installer skill to set up the workspace.
3. The installer fetches Superpowers from the official upstream source.
4. The installer creates or updates the Multica skills and agents.
5. Future work moves through Multica `@agent` mentions and human review gates.

## Goals

- Keep this repository as a standalone Multica installer, not a fork or mirror of Superpowers.
- Add only a root `SKILL.md` plus files under `multica-installer/` during implementation.
- Fetch Superpowers skill content from the official upstream source at setup time.
- Pin the upstream Superpowers source ref for reproducible installs.
- Create one Multica agent per upstream Superpowers skill.
- Preserve upstream skill behavior and add only Multica-specific wrapper instructions for handoffs and review gates.
- Use the installer's current Multica runtime and model for all generated agents in V1.
- Make setup idempotent enough that rerunning it does not silently create duplicate agents or skills.

## Non-Goals

- Do not edit upstream Superpowers skill content in place.
- Do not vendor or mirror `skills/` into this repository for V1.
- Do not add official harness support to upstream Superpowers core.
- Do not support per-agent runtime or model selection in V1.
- Do not rely on a fully automatic human identity guess when Multica does not expose one clearly.

## Multica Documentation Basis

The design uses these Multica behaviors from the current docs:

- A Multica skill is a `SKILL.md` knowledge pack with optional supporting files.
- Skills can be imported through `multica skill import ...`.
- Agents can be created through `multica agent create`, with required name and runtime information plus optional description and instructions.
- Agents can be assigned to issues or triggered by `@agent` mentions in comments.
- Human workspace members can be mentioned in issue comments and receive notifications.
- Issues support status transitions such as `in_review` and `blocked`.

## Repository Layout

Implementation should keep the root minimal:

```text
SKILL.md
multica-installer/
  README.md
  manifest.json
  agents/
    using-superpowers.md
    brainstorming.md
    using-git-worktrees.md
    writing-plans.md
    executing-plans.md
    subagent-driven-development.md
    dispatching-parallel-agents.md
    test-driven-development.md
    systematic-debugging.md
    requesting-code-review.md
    receiving-code-review.md
    verification-before-completion.md
    finishing-a-development-branch.md
    writing-skills.md
  templates/
    agent-wrapper.md
    human-gate.md
    setup-summary.md
  scripts/
    validate-manifest.*
    render-dry-run.*
```

`SKILL.md` is the installer entrypoint that Multica imports. Everything else is installer support material. The existing upstream Superpowers files in this checkout should be left alone except where the implementation plan explicitly needs read-only reference.

## Upstream Source

`multica-installer/manifest.json` should pin the upstream Superpowers source:

```json
{
  "superpowers_source": {
    "type": "github",
    "repo": "obra/superpowers",
    "ref": "v5.1.0",
    "skills_path": "skills"
  }
}
```

The installer uses this source to import or fetch each upstream skill at setup time. It must treat upstream skill files as authoritative behavior. Multica-specific changes belong in wrapper instructions, not in rewritten copies of upstream `SKILL.md` files.

## Agent Manifest

V1 creates these agents:

| Agent | Upstream skill |
| --- | --- |
| `using-superpowers` | `using-superpowers` |
| `brainstorming` | `brainstorming` |
| `using-git-worktrees` | `using-git-worktrees` |
| `writing-plans` | `writing-plans` |
| `executing-plans` | `executing-plans` |
| `subagent-driven-development` | `subagent-driven-development` |
| `dispatching-parallel-agents` | `dispatching-parallel-agents` |
| `test-driven-development` | `test-driven-development` |
| `systematic-debugging` | `systematic-debugging` |
| `requesting-code-review` | `requesting-code-review` |
| `receiving-code-review` | `receiving-code-review` |
| `verification-before-completion` | `verification-before-completion` |
| `finishing-a-development-branch` | `finishing-a-development-branch` |
| `writing-skills` | `writing-skills` |

The installer skill itself is separate from these agents. It exists only to set up or repair the workspace.

## Handoff Model

Generated agents should use Multica comments for handoffs:

- Mention another agent with `@agent-slug` only when the current phase can safely continue automatically.
- Mention the configured human reviewer when the upstream Superpowers workflow requires approval.
- Do not mention a next agent after posting a human review gate.
- Do not self-mention.
- If blocked, post the blocker, mention the human reviewer, and stop.

Default happy path:

```text
@using-superpowers
@brainstorming
human review gate
@writing-plans
human review gate
@using-git-worktrees
@executing-plans or @subagent-driven-development
@requesting-code-review
@verification-before-completion
@finishing-a-development-branch
human completion gate
```

Conditional agents:

- `@systematic-debugging` for bugs, failing tests, or unexpected behavior.
- `@test-driven-development` for feature or bugfix implementation.
- `@receiving-code-review` when review feedback arrives.
- `@writing-skills` for creating or modifying skills.
- `@dispatching-parallel-agents` when independent tasks can run concurrently.

## Human Review Gates

The installer must collect a human reviewer mention during setup unless Multica exposes an unambiguous current member mention. The setup instructions should prefer asking the user for the mention instead of guessing.

Human gates occur after:

- `brainstorming` writes or presents a design spec.
- `writing-plans` writes an implementation plan.
- `finishing-a-development-branch` needs a merge, PR, keep, or cleanup decision.
- Any agent reaches a blocker that requires human input.

At each gate, the agent should:

1. Set or request issue status `in_review` for review gates, or `blocked` for blockers.
2. Post a concise comment with the artifact path or decision needed.
3. Mention the configured human reviewer.
4. Stop without mentioning the next agent.

The human resumes the workflow by approving in a comment and mentioning the next agent.

## Installer Flow

When asked to set up the workspace, `multica-superpowers` should:

1. Confirm Multica CLI/API access and that it is running in a Multica task context.
2. Determine the current runtime and model used by the installer.
3. Ask for the human reviewer mention if it cannot infer one safely.
4. Load `multica-installer/manifest.json`.
5. Fetch or import the pinned upstream Superpowers skills.
6. Create or update one Multica workspace skill per upstream skill.
7. Create or update one Multica agent per manifest entry using the installer's runtime and model.
8. Attach the corresponding workspace skill to each agent.
9. Apply the Multica wrapper instructions for handoffs and human gates.
10. Post a setup summary listing created or updated skills and agents.

## Idempotency and Recovery

The installer should not silently create duplicates. For every skill or agent, it should check whether an object with the expected slug or title already exists.

If the object exists and is managed by this installer, update it. If it exists but ownership is unclear, stop and ask the human before replacing it.

When setup fails, the installer should report:

- completed steps,
- failed step,
- likely cause,
- retry command or action,
- whether rerunning setup is safe.

## Validation

V1 should include validation that can run without mutating a Multica workspace:

- Manifest validation: every expected Superpowers skill has exactly one agent mapping.
- Handoff validation: every automatic next-agent mention points to a manifest agent.
- Gate validation: review gates mention the human reviewer placeholder and do not include next-agent mentions.
- Dry-run rendering: print the intended Multica skill and agent operations.

## Acceptance Test

The end-to-end acceptance test is:

1. Import the standalone `multica-superpowers` skill into a clean Multica workspace.
2. Assign a task to the installer: "Set up this workspace with Superpowers."
3. Confirm the installer creates or updates the 14 working agents.
4. Create a clean issue with: "Let's make a react todo list."
5. Confirm the workflow reaches `@brainstorming` before implementation.
6. Confirm `@brainstorming` stops for human spec review instead of mentioning `@writing-plans`.
7. Approve the spec as the human and mention `@writing-plans`.
8. Confirm `@writing-plans` runs and stops for human plan review.

## Open Implementation Questions

- Whether Multica exposes the installer's runtime and model directly through CLI/API, or whether the installer must ask the human to confirm them.
- Whether attaching a workspace skill to an agent is available through the same documented CLI path or requires API/UI fallback.
- Whether current-member mention can be inferred safely. If not, setup asks for a reviewer mention.
