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
  const firstGateName = agent.gates[0] ?? null;
  const gate = firstGateName ? manifest.human_gates[firstGateName] : null;
  if (firstGateName && !gate) {
    throw new Error(`Unknown human gate "${firstGateName}" for agent "${agent.slug}".`);
  }

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
    completion_rule: completionRule,
  });

  fs.writeFileSync(path.join(outputDir, `${agent.slug}.md`), `${content.trim()}\n`);
}

console.log(`Rendered ${manifest.agents.length} agent instruction files.`);
