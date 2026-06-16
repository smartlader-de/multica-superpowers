import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

// --- Structured error carrying the failing CLI invocation ---
class CliError extends Error {
  constructor(message, { args, stdout, stderr } = {}) {
    super(message);
    this.args = args;
    this.stdout = stdout ?? "";
    this.stderr = stderr ?? "";
  }
}

// --- The ONLY place multica is invoked (no shell strings, no heredocs) ---
function runCli(args, { parseJson = true } = {}) {
  let stdout;
  try {
    stdout = execFileSync("multica", args, { encoding: "utf8" });
  } catch (err) {
    throw new CliError(`multica ${args.join(" ")} failed: ${err.message}`, {
      args,
      stdout: err.stdout,
      stderr: err.stderr,
    });
  }
  if (parseJson) {
    return JSON.parse(stdout);
  }
  return stdout;
}

// --- All phase failures route through here; never mark done on partial work ---
function blockAndExit(issueId, reviewerMention, reason) {
  console.error(`ERROR: ${reason}`);
  if (issueId) {
    try {
      runCli(["issue", "status", issueId, manifest.human_gates.blocked.status], { parseJson: false });
    } catch {
      console.error("WARNING: Could not set blocked status on issue.");
    }
    if (reviewerMention) {
      try {
        runCli(
          ["issue", "comment", issueId, "--body", `Work is blocked: ${reason}\n\n${reviewerMention}`],
          { parseJson: false }
        );
      } catch {
        console.error("WARNING: Could not post blocked comment.");
      }
    }
  }
  process.exitCode = 1;
}

// --- Mode dispatch ---
const cliArgs = process.argv.slice(2);
const mode = cliArgs[0];

if (mode === "--plan") {
  runPlan();
} else if (mode === "--apply") {
  const planPath = cliArgs[1] ?? path.join(root, "install-plan.json");
  runApply(planPath);
} else {
  console.error(
    "Usage: node multica-installer/scripts/install.mjs --plan | --apply [<install-plan.json>]"
  );
  process.exitCode = 1;
}

// =============================================================================
// PLAN MODE — read-only discovery and plan emission
// =============================================================================

function runPlan() {
  const discovery = discover();
  const plan = computePlan(discovery);
  emitPlan(plan);
}

// Pure-ish read: verify CLI, built-in skills, then fetch workspace state
function discover() {
  let profile;
  try {
    profile = runCli(["user", "profile", "get", "--output", "json"]);
  } catch (err) {
    console.error("ERROR: multica CLI unavailable or not authenticated:", err.message);
    process.exitCode = 1;
    process.exit(1);
  }

  const workspace = runCli(["workspace", "get", "--output", "json"]);
  const members = runCli(["workspace", "member", "list", "--output", "json"]);
  const existingSkills = runCli(["skill", "list", "--output", "json"]);
  const existingAgents = runCli(["agent", "list", "--output", "json"]);

  // Hard stop if required built-in skills are absent
  const skillNames = new Set((existingSkills ?? []).map((s) => s.name ?? s.slug ?? ""));
  for (const required of ["multica-mentioning", "multica-working-on-issues"]) {
    if (!skillNames.has(required)) {
      console.error(`ERROR: Required built-in skill '${required}' not found in workspace.`);
      process.exitCode = 1;
      process.exit(1);
    }
  }

  return {
    workspaceId: workspace.id ?? workspace.workspace_id ?? null,
    runtimeId: profile.runtime_id ?? profile.runtimeId ?? null,
    model: profile.model ?? null,
    members: members ?? [],
    existingSkills: existingSkills ?? [],
    existingAgents: existingAgents ?? [],
  };
}

// Decide create/update/skip per agent+skill; build typed mention map
function computePlan(discovery) {
  const { existingSkills, existingAgents, members } = discovery;
  const managedLabel = manifest.installer.managed_by_label;

  const skills = [];
  const agents = [];
  const mentions = {};
  const ambiguous = [];

  for (const agentDef of manifest.agents) {
    // --- skill create-vs-update ---
    const existingSkill = existingSkills.find((s) => (s.name ?? s.slug) === agentDef.skill);
    let skillAction, skillId = null;
    if (!existingSkill) {
      skillAction = "create";
    } else if (
      (existingSkill.labels ?? []).includes(managedLabel) ||
      existingSkill.managed_by === managedLabel
    ) {
      skillAction = "update";
      skillId = existingSkill.id;
    } else {
      ambiguous.push({
        type: "skill",
        name: agentDef.skill,
        reason: "Exists without managed-by label; ownership unclear",
      });
      skillAction = "skip";
    }
    skills.push({ name: agentDef.skill, action: skillAction, skillId });

    // --- agent create-vs-update ---
    const existingAgent = existingAgents.find((a) => (a.name ?? a.slug) === agentDef.slug);
    let agentAction, agentId = null;
    if (!existingAgent) {
      agentAction = "create";
    } else if (
      (existingAgent.labels ?? []).includes(managedLabel) ||
      existingAgent.managed_by === managedLabel
    ) {
      agentAction = "update";
      agentId = existingAgent.id;
    } else {
      ambiguous.push({
        type: "agent",
        slug: agentDef.slug,
        reason: "Exists without managed-by label; ownership unclear",
      });
      agentAction = "skip";
    }
    agents.push({ slug: agentDef.slug, action: agentAction, agentId, skillId: null });

    // --- next-agent typed mention ---
    if (agentDef.next) {
      mentions[`@${agentDef.next}`] = { type: "agent", targetSlug: agentDef.next };
    }
  }

  // --- reviewer typed mention (member, not agent — enqueues no run) ---
  const reviewerToken = manifest.human_reviewer.placeholder; // "@human-reviewer"
  let reviewer = null;
  if (members.length === 1) {
    const m = members[0];
    const userId = m.user_id ?? m.userId;
    mentions[reviewerToken] = { type: "member", userId };
    reviewer = { type: "member", userId, mention: reviewerToken };
  } else if (members.length === 0) {
    ambiguous.push({ type: "reviewer", placeholder: reviewerToken, reason: "No workspace members found" });
  } else {
    ambiguous.push({
      type: "reviewer",
      placeholder: reviewerToken,
      reason: 'Multiple members found; set mentions["@human-reviewer"].userId manually in install-plan.json',
      candidates: members.map((m) => ({ name: m.name ?? m.username, userId: m.user_id ?? m.userId })),
    });
  }

  return {
    schema_version: 1,
    runtime_id: discovery.runtimeId,
    model: discovery.model,
    workspace_id: discovery.workspaceId,
    issue_id: process.env.MULTICA_ISSUE_ID ?? null,
    reviewer,
    agents,
    skills,
    mentions,
    ambiguous,
  };
}

// Write install-plan.json; print summary counts and tell user to review before --apply
function emitPlan(plan) {
  const planPath = path.join(root, "install-plan.json");
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + "\n");

  const creates = plan.agents.filter((a) => a.action === "create").length;
  const updates = plan.agents.filter((a) => a.action === "update").length;
  const skips = plan.agents.filter((a) => a.action === "skip").length;
  console.log(
    `Plan written: ${creates} create, ${updates} update, ${skips} skip | Ambiguous: ${plan.ambiguous.length}`
  );
  if (plan.ambiguous.length > 0) {
    console.log("Resolve ambiguous[] in install-plan.json before running --apply.");
  }
  console.log(`Review ${planPath}, then: node multica-installer/scripts/install.mjs --apply`);
}

// =============================================================================
// APPLY MODE — deterministic mutating executor; consumes the plan, no re-deciding
// =============================================================================

function runApply(planPath) {
  const plan = loadPlan(planPath);
  if (!plan) return;

  try {
    importSkills(plan);
    upsertAgents(plan);
    attachSkills(plan);
    finalizeMentions(plan);
    verifyInstall(plan);
    postSummary(plan);
    complete(plan);
  } catch (err) {
    blockAndExit(
      plan.issue_id,
      plan.reviewer?.mention,
      err instanceof CliError ? `CLI failure: ${err.message}` : err.message
    );
  }
}

// Read + validate plan; refuse on non-empty ambiguous[] with no mutating calls
function loadPlan(planPath) {
  if (!fs.existsSync(planPath)) {
    console.error(`ERROR: Plan file not found: ${planPath}`);
    console.error("Run --plan first, then review install-plan.json before --apply.");
    process.exitCode = 1;
    return null;
  }

  let plan;
  try {
    plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
  } catch (err) {
    console.error(`ERROR: Could not parse plan file: ${err.message}`);
    process.exitCode = 1;
    return null;
  }

  if (plan.schema_version !== 1) {
    console.error(`ERROR: Unsupported schema_version ${plan.schema_version} (expected 1)`);
    process.exitCode = 1;
    return null;
  }

  if (plan.ambiguous && plan.ambiguous.length > 0) {
    console.error("ERROR: Plan has unresolved ambiguities — resolve in install-plan.json first:");
    for (const item of plan.ambiguous) {
      console.error(`  - [${item.type}] ${item.name ?? item.slug ?? item.placeholder}: ${item.reason}`);
    }
    process.exitCode = 1;
    return null;
  }

  return plan;
}

// Import upstream skills from pinned source; capture IDs for attach phase
function importSkills(plan) {
  const { superpowers_source } = manifest;
  const baseUrl = `https://github.com/${superpowers_source.repo}/tree/${superpowers_source.ref}/${superpowers_source.skills_path}`;

  for (const skill of plan.skills) {
    if (skill.action !== "create") continue;
    const result = runCli(["skill", "import", "--url", `${baseUrl}/${skill.name}`, "--output", "json"]);
    skill.skillId = result.id ?? result.skill_id;
    console.log(`Imported skill: ${skill.name} (${skill.skillId})`);
  }
}

// Create or update agents; pass --instructions as a single argv element (no heredoc, no shell)
function upsertAgents(plan) {
  const agentsDir = path.join(root, "agents");

  for (const agentEntry of plan.agents) {
    if (agentEntry.action === "skip") continue;

    const rendered = fs.readFileSync(path.join(agentsDir, `${agentEntry.slug}.md`), "utf8");
    const sharedArgs = [
      "--runtime-id", plan.runtime_id,
      "--model", plan.model,
      "--max-concurrent-tasks", String(manifest.installer.agent_defaults.max_concurrent_tasks),
      "--instructions", rendered,
      "--output", "json",
    ];

    if (agentEntry.action === "create") {
      const result = runCli(["agent", "create", "--name", agentEntry.slug, ...sharedArgs]);
      agentEntry.agentId = result.id ?? result.agent_id;
      console.log(`Created agent: ${agentEntry.slug} (${agentEntry.agentId})`);
    } else {
      runCli(["agent", "update", agentEntry.agentId, ...sharedArgs]);
      console.log(`Updated agent: ${agentEntry.slug} (${agentEntry.agentId})`);
    }
  }
}

// Attach each agent's skill using IDs captured in importSkills/upsertAgents
function attachSkills(plan) {
  for (const agentEntry of plan.agents) {
    if (agentEntry.action === "skip") continue;

    const agentDef = manifest.agents.find((a) => a.slug === agentEntry.slug);
    const skillEntry = plan.skills.find((s) => s.name === agentDef.skill);
    if (!skillEntry?.skillId) {
      throw new Error(`No skillId resolved for ${agentDef.skill} (agent ${agentEntry.slug})`);
    }

    runCli([
      "agent", "skills", "set", agentEntry.agentId,
      "--skill-ids", skillEntry.skillId,
      "--output", "json",
    ]);
    agentEntry.skillId = skillEntry.skillId;
    console.log(`Attached ${agentDef.skill} → ${agentEntry.slug}`);
  }
}

// 2-phase typed placeholder→mention:// replacement; idempotent and link-safe
function finalizeMentions(plan) {
  const agentsDir = path.join(root, "agents");
  const agentIdMap = Object.fromEntries(
    plan.agents.filter((a) => a.agentId).map((a) => [a.slug, a.agentId])
  );

  for (const agentEntry of plan.agents) {
    if (agentEntry.action === "skip") continue;

    let instructions = fs.readFileSync(path.join(agentsDir, `${agentEntry.slug}.md`), "utf8");

    for (const [token, mentionDef] of Object.entries(plan.mentions)) {
      const label = token.slice(1); // strip leading @
      let link;

      if (mentionDef.type === "agent") {
        const targetId = agentIdMap[mentionDef.targetSlug];
        if (!targetId) continue;
        if (instructions.includes(`mention://agent/${targetId}`)) continue; // idempotent
        link = `[@${label}](mention://agent/${targetId})`;
      } else if (mentionDef.type === "member") {
        if (instructions.includes(`mention://member/${mentionDef.userId}`)) continue; // idempotent
        link = `[@${label}](mention://member/${mentionDef.userId})`;
      } else {
        continue;
      }

      // Replace only bare @token — skip tokens already inside a markdown link label
      instructions = instructions.replace(
        new RegExp(`(?<!\\[)@${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\]\\(mention://)`, "g"),
        link
      );
    }

    runCli(["agent", "update", agentEntry.agentId, "--instructions", instructions, "--output", "json"]);
    console.log(`Finalized mentions: ${agentEntry.slug}`);
  }
}

// Self-verification gate — must pass before postSummary/complete
function verifyInstall(plan) {
  const liveAgents = runCli(["agent", "list", "--output", "json"]);
  // Source count from manifest so the gate stays correct if manifest changes
  const expectedCount = manifest.agents.length;
  const installedSlugs = new Set(plan.agents.filter((a) => a.agentId).map((a) => a.slug));
  const verifiedAgents = liveAgents.filter((a) => installedSlugs.has(a.name ?? a.slug));

  if (verifiedAgents.length !== expectedCount) {
    throw new Error(
      `Verification failed: expected ${expectedCount} agents, found ${verifiedAgents.length} live`
    );
  }

  for (const liveAgent of verifiedAgents) {
    const slug = liveAgent.name ?? liveAgent.slug;
    const agentEntry = plan.agents.find((a) => a.slug === slug);
    const agentDef = manifest.agents.find((a) => a.slug === slug);
    const instructions = liveAgent.instructions ?? "";
    const isGated = (agentDef?.gates ?? []).length > 0;

    if (!agentEntry?.skillId) {
      throw new Error(`Verification failed: agent ${slug} has no skill attached in plan`);
    }

    // No raw @human-reviewer remaining
    if (instructions.includes("@human-reviewer") && !instructions.includes("mention://member/")) {
      throw new Error(`Verification failed: ${slug} has raw @human-reviewer without member mention link`);
    }

    // Gate agents must have typed member mention
    if (isGated && !instructions.includes("mention://member/")) {
      throw new Error(`Verification failed: ${slug} (gate agent) missing typed member mention`);
    }

    // No nested mention markdown
    if (/\[.*\]\(mention:\/\/[^)]+\).*\]\(mention:\/\//.test(instructions)) {
      throw new Error(`Verification failed: ${slug} has nested mention markdown`);
    }
  }

  console.log(`Verification passed: ${verifiedAgents.length}/${expectedCount} agents.`);
}

// Post setup summary comment; skip gracefully if no issue_id
function postSummary(plan) {
  if (!plan.issue_id) {
    console.log("No issue_id — skipping summary post (set MULTICA_ISSUE_ID to enable).");
    return;
  }

  const createdAgents = plan.agents.filter((a) => a.action === "create").map((a) => a.slug);
  const updatedAgents = plan.agents.filter((a) => a.action === "update").map((a) => a.slug);
  const importedSkills = plan.skills.filter((s) => s.action === "create").map((s) => s.name);

  const body = [
    "## Multica Superpowers Setup Complete",
    "",
    ...(createdAgents.length ? [`**Created agents (${createdAgents.length}):** ${createdAgents.join(", ")}`] : []),
    ...(updatedAgents.length ? [`**Updated agents (${updatedAgents.length}):** ${updatedAgents.join(", ")}`] : []),
    ...(importedSkills.length ? [`**Imported skills (${importedSkills.length}):** ${importedSkills.join(", ")}`] : []),
    "",
    `**Total agents installed:** ${manifest.agents.length}`,
  ].join("\n");

  runCli(["issue", "comment", plan.issue_id, "--body", body], { parseJson: false });
  console.log("Posted setup summary.");
}

// Mark done ONLY after verifyInstall passes — fixes the log bug where issue was left in_review
function complete(plan) {
  if (!plan.issue_id) {
    console.log("No issue_id — skipping done status (set MULTICA_ISSUE_ID to enable).");
    console.log("Setup complete.");
    return;
  }
  runCli(["issue", "status", plan.issue_id, "done"], { parseJson: false });
  console.log(`Issue ${plan.issue_id} marked done. Setup complete.`);
}
