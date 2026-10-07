import { existsSync } from "node:fs";
import { join } from "node:path";
import { copy, listPresets } from "../fs-utils.js";

export function runInit({ cwd, templates, presetsDir, force, dryRun }) {
  // Walidacja: czy SDD framework jest zainstalowany?
  const sddPaths = [
    join(cwd, "node_modules", "@odyseusz426", "claude-npm-sdd"),
    join(cwd, ".claude", "CLAUDE.md"),
  ];
  const sddInstalled = sddPaths.some((p) => existsSync(p));
  if (!sddInstalled) {
    throw new Error(
      "@odyseusz426/claude-npm-sdd nie jest zainstalowany w tym projekcie.\n" +
        "Uruchom najpierw:\n" +
        "  npm i -D @odyseusz426/claude-npm-sdd && npx sdd init"
    );
  }

  const agentsSrc = join(templates, ".claude", "agents");
  const commandsSrc = join(templates, ".claude", "commands");
  const agentsDst = join(cwd, ".claude", "agents");
  const commandsDst = join(cwd, ".claude", "commands");

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
  results.push(copy(agentsSrc, agentsDst, { force, label: "migration agents" }));
  results.push(copy(commandsSrc, commandsDst, { force, label: "migration commands" }));

  const presets = listPresets(presetsDir);

  return { dryRun: false, results, presets };
}
