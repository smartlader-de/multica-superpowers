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
  const rendered = templateText.replace(/\{\{([^}]+)\}\}/g, (match, rawKey) => {
    const key = rawKey.trim();
    if (!(key in replacements)) {
      throw new Error(`Missing template replacement: ${key}`);
    }

    return replacements[key];
  });

  if (rendered.includes("{{") || rendered.includes("}}")) {
    throw new Error("Rendered template contains unreplaced placeholder delimiters.");
  }

  return rendered;
}

for (const agent of manifest.agents) {
  for (const gateName of agent.gates) {
    if (!(gateName in manifest.human_gates)) {
      throw new Error(`Unknown human gate "${gateName}" for agent "${agent.slug}".`);
    }
  }

  const firstGateName = agent.gates[0] ?? null;
  const gate = firstGateName ? manifest.human_gates[firstGateName] : null;
  const next = agent.next ?? "human-reviewer";
  const reviewer = manifest.human_reviewer.placeholder;
  const completionRule = gate
    ? `- At the \`${agent.skill}\` human gate, set or request status \`${gate.status}\` and mention ${reviewer} as a \`member\` mention — the status change surfaces the gate; the member mention renders a link but does not auto-run anyone. Stop without mentioning the next agent; the human resumes by mentioning the next agent.`
    : `- When the \`${agent.skill}\` phase completes, post a concise completion comment and hand off to \`@${next}\` with an \`agent\` mention link built per \`multica-mentioning\` — an agent mention enqueues that agent's run; a bare name does nothing.`;
  const multicaRules = (agent.multica_rules ?? []).length > 0
    ? `\n\n## Multica Issue Rules\n\n${agent.multica_rules.map((rule) => `- ${rule}`).join("\n")}`
    : "";
  const gateBlock = gate ? `\n\n## Human gate\n\n${gate.message}` : "";
  const content = render(template, {
    slug: agent.slug,
    skill: agent.skill,
    human_reviewer: reviewer,
    completion_rule: completionRule,
    multica_rules: multicaRules,
    gate_block: gateBlock,
  });

  fs.writeFileSync(path.join(outputDir, `${agent.slug}.md`), `${content.trim()}\n`);
}

console.log(`Rendered ${manifest.agents.length} agent instruction files.`);
