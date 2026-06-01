import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const agentsDir = path.join(root, "agents");
const templatesDir = path.join(root, "templates");

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

if (manifest.superpowers_source.type !== "github") {
  fail("superpowers_source.type must be github");
}

if (manifest.superpowers_source.repo !== "obra/superpowers") {
  fail("superpowers_source.repo must be obra/superpowers");
}

if (manifest.superpowers_source.ref !== "v5.1.0") {
  fail("superpowers_source.ref must be v5.1.0");
}

if (manifest.superpowers_source.skills_path !== "skills") {
  fail("superpowers_source.skills_path must be skills");
}

if (manifest.installer.agent_defaults?.max_concurrent_tasks !== 1) {
  fail("installer.agent_defaults.max_concurrent_tasks must be 1 for sequential V1 execution");
}

const slugs = new Set((manifest.agents ?? []).map((agent) => agent.slug).filter(Boolean));
const seenSlugs = new Set();
const skills = new Set();
const humanReviewerSlug = manifest.human_reviewer.placeholder.replace(/^@/, "");

function extractMentions(rendered) {
  return [...rendered.matchAll(/@([a-z0-9-]+)/g)].map((match) => match[1]);
}

function validateRenderedMentions(label, rendered, options = {}) {
  const mentions = extractMentions(rendered);
  const manifestAgentMentions = mentions.filter((mention) => slugs.has(mention));

  for (const mention of mentions) {
    if (mention !== humanReviewerSlug && !slugs.has(mention)) {
      fail(`${label} mentions unknown @${mention}`);
    }
  }

  if (options.requireHumanReviewer && !mentions.includes(humanReviewerSlug)) {
    fail(`${label} does not mention ${manifest.human_reviewer.placeholder}`);
  }

  if (options.forbidAgentMentions) {
    for (const mention of manifestAgentMentions) {
      fail(`${label} should not mention agent @${mention}`);
    }
  }

  if (options.expectedNext) {
    if (!mentions.includes(options.expectedNext)) {
      fail(`${label} does not mention expected next agent @${options.expectedNext}`);
    }

    for (const mention of manifestAgentMentions) {
      if (mention !== options.expectedNext) {
        fail(`${label} mentions unexpected agent @${mention}`);
      }
    }
  }
}

function validateNoUnsafeGateMentions(label, content) {
  for (const agent of manifest.agents ?? []) {
    if ((agent.gates ?? []).length > 0 && agent.next && content.includes(`@${agent.next}`)) {
      fail(`${label} contains unsafe gated next-agent mention @${agent.next}`);
    }
  }
}

for (const agent of manifest.agents ?? []) {
  if (!agent.slug || !agent.skill) {
    fail(`agent is missing slug or skill: ${JSON.stringify(agent)}`);
    continue;
  }

  if (seenSlugs.has(agent.slug)) {
    fail(`duplicate agent slug: ${agent.slug}`);
  }
  seenSlugs.add(agent.slug);

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

    if ((agent.gates ?? []).length > 0) {
      validateRenderedMentions(`${agent.slug} gate instructions`, rendered, {
        requireHumanReviewer: true,
        forbidAgentMentions: true,
      });
    } else if (agent.next) {
      validateRenderedMentions(`${agent.slug} instructions`, rendered, {
        expectedNext: agent.next,
      });
    } else {
      validateRenderedMentions(`${agent.slug} instructions`, rendered, {
        forbidAgentMentions: true,
      });
    }
  }
}

for (const [gateName, gate] of Object.entries(manifest.human_gates ?? {})) {
  validateNoUnsafeGateMentions(`human gate ${gateName}`, gate.message ?? "");
}

for (const templateFile of fs.readdirSync(templatesDir).filter((file) => file.endsWith(".md"))) {
  const template = fs.readFileSync(path.join(templatesDir, templateFile), "utf8");
  validateNoUnsafeGateMentions(`template ${templateFile}`, template);
}

const dryRunScript = fs.readFileSync(path.join(root, "scripts", "render-dry-run.mjs"), "utf8");
validateNoUnsafeGateMentions("dry-run script", dryRunScript);

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
