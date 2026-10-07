#!/usr/bin/env node
import { readFileSync, cpSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const templates = join(root, "templates");
const presetsDir = join(templates, "presets");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const [command, ...args] = process.argv.slice(2);
const force = args.includes("--force");

function copy(from, to, label) {
  if (!existsSync(from)) {
    console.error(`Source not found: ${from}`);
    process.exit(1);
  }
  if (existsSync(to) && !force) {
    console.error(`Target already exists: ${to}`);
    console.error(`Use --force to overwrite.`);
    process.exit(1);
  }
  cpSync(from, to, { recursive: true, force });
  console.log(`\u2713 ${label || from} \u2192 ${to}${force ? " (overwritten)" : ""}`);
}

function listPresets() {
  if (!existsSync(presetsDir)) return [];
  return readdirSync(presetsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

switch (command) {
  case "init": {
    const cwd = process.cwd();
    const agentsSrc = join(templates, ".claude", "agents");
    const commandsSrc = join(templates, ".claude", "commands");
    const agentsDst = join(cwd, ".claude", "agents");
    const commandsDst = join(cwd, ".claude", "commands");

    copy(agentsSrc, agentsDst, "migration agents");
    copy(commandsSrc, commandsDst, "migration commands");

    const presets = listPresets();

    console.log(`
Migration toolkit installed.

Commands: /migrate, /migrate-setup, /migrate-cr, /migrate-fix
Agents:   migration-analyzer, migration-writer, migration-supervisor, migration-cr

Available presets: ${presets.length ? presets.join(", ") : "(none)"}
Load a preset:  claude-migrate preset ${presets[0] || "<name>"}
`);
    break;
  }

  case "preset": {
    const presetName = args.find((a) => !a.startsWith("--"));
    if (!presetName) {
      const presets = listPresets();
      if (presets.length === 0) {
        console.error("No presets available.");
        process.exit(1);
      }
      console.log("Available presets:");
      presets.forEach((p) => console.log(`  - ${p}`));
      console.log(`\nUsage: claude-migrate preset <name> [--force]`);
      process.exit(0);
    }

    const presetSrc = join(presetsDir, presetName);
    if (!existsSync(presetSrc)) {
      console.error(`Preset not found: ${presetName}`);
      console.error(`Available: ${listPresets().join(", ") || "(none)"}`);
      process.exit(1);
    }

    const cwd = process.cwd();

    // Copy preset.md → .claude/migrate.preset.md
    const presetMd = join(presetSrc, "preset.md");
    if (existsSync(presetMd)) {
      copy(presetMd, join(cwd, ".claude", "migrate.preset.md"), `preset: ${presetName}`);
    }

    // Copy reference-patterns if exists
    const refPatterns = join(presetSrc, "reference-patterns.md");
    if (existsSync(refPatterns)) {
      copy(refPatterns, join(cwd, "ai", "reference-patterns", `${presetName}-patterns.md`), "reference patterns");
    }

    console.log(`
Preset "${presetName}" loaded.

Preset file: .claude/migrate.preset.md
Ready to migrate: /migrate <source-file> --propose
`);
    break;
  }

  case "presets": {
    const presets = listPresets();
    if (presets.length === 0) {
      console.log("No presets available.");
    } else {
      console.log("Available presets:");
      presets.forEach((p) => console.log(`  - ${p}`));
    }
    break;
  }

  case "--version":
  case "-v":
    console.log(pkg.version);
    break;

  default:
    console.log(`
Claude Migrate v${pkg.version} \u2014 Universal migration toolkit for Claude Code

Usage:
  claude-migrate init                     install agents & commands into project
  claude-migrate init --force             overwrite existing files
  claude-migrate preset <name>            load a technology preset
  claude-migrate preset <name> --force    overwrite existing preset
  claude-migrate presets                  list available presets
  claude-migrate --version               show version
`);
    process.exit(command ? 1 : 0);
}
