import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

function renderNext(agent) {
  if (!agent.next) {
    return "human completion decision";
  }

  if (agent.gates.length > 0) {
    return `human gate (${agent.gates.join(", ")}); human resumes by mentioning ${agent.next}`;
  }

  return `@${agent.next}`;
}

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
  console.log(`- Next: ${renderNext(agent)}`);
  console.log(`- Gates: ${agent.gates.length > 0 ? agent.gates.join(", ") : "none"}`);
  console.log("");
}
