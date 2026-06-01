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
  "writing-skills",
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

    if ((agent.gates ?? []).length > 0 && agent.next) {
      const executableNextMention = `@${agent.next}`;
      const backtickedNextMention = `\`@${agent.next}\``;
      if (rendered.includes(executableNextMention) || rendered.includes(backtickedNextMention)) {
        fail(`${agent.slug} gate instructions should not auto-mention @${agent.next}`);
      }
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
