#!/usr/bin/env node
import { readFileSync, cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const templates = join(root, "templates");
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

switch (command) {
  case "init": {
    const cwd = process.cwd();
    const agentsSrc = join(templates, ".claude", "agents");
    const commandsSrc = join(templates, ".claude", "commands");
    const agentsDst = join(cwd, ".claude", "agents");
    const commandsDst = join(cwd, ".claude", "commands");

    copy(agentsSrc, agentsDst, "migration agents");
    copy(commandsSrc, commandsDst, "migration commands");

    const patternsSrc = join(templates, "reference-patterns");
    const patternsDst = join(cwd, "ai", "reference-patterns");
    if (existsSync(patternsSrc)) {
      copy(patternsSrc, patternsDst, "reference-patterns");
    }

    console.log(`
Migration toolkit installed.

Commands: /migrate, /migrate-cr, /migrate-fix, /migrate-split
Agents:   migration-analyzer, migration-spec-writer, migration-supervisor, migration-cr, migration-split

Requires @odyseusz426/claude-npm-sdd as base framework.
`);
    break;
  }
  case "--version":
  case "-v":
    console.log(pkg.version);
    break;
  default:
    console.log(`
Claude Migrate v${pkg.version} — Cypress \u2192 Playwright migration toolkit

Usage:
  claude-migrate init              copy migration agents & commands into project
  claude-migrate init --force      overwrite existing files
  claude-migrate --version         show version
`);
    process.exit(command ? 1 : 0);
}
