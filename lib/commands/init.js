import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { copy, listPresets } from "../fs-utils.js";

export function runInit({ cwd, templates, presetsDir, force, dryRun }) {
  // Walidacja: czy SDD framework jest zainstalowany globalnie?
  const sddHome = join(homedir(), ".sdd");
  if (!existsSync(join(sddHome, ".claude"))) {
    throw new Error(
      "SDD framework nie jest zainstalowany.\n" +
        "Uruchom najpierw:\n" +
        "  npm i -g @odyseusz426/claude-npm-sdd && sdd init"
    );
  }

  const agentsSrc = join(templates, ".claude", "agents");
  const commandsSrc = join(templates, ".claude", "commands");
  const agentsDst = join(sddHome, ".claude", "agents");
  const commandsDst = join(sddHome, ".claude", "commands");

  if (dryRun) {
    return {
      dryRun: true,
      files: [
        { from: agentsSrc, to: agentsDst },
        { from: commandsSrc, to: commandsDst },
      ],
    };
  }

  const results = [];
  results.push(copy(agentsSrc, agentsDst, { force, label: "migration agents → ~/.sdd/.claude/agents" }));
  results.push(copy(commandsSrc, commandsDst, { force, label: "migration commands → ~/.sdd/.claude/commands" }));

  const presets = listPresets(presetsDir);

  return { dryRun: false, results, presets };
}
