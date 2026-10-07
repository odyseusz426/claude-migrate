#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runInit } from "../lib/commands/init.js";
import { runPreset } from "../lib/commands/preset.js";
import { listPresets } from "../lib/fs-utils.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const templates = join(root, "templates");
const presetsDir = join(templates, "presets");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const [command, ...args] = process.argv.slice(2);
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");
const update = args.includes("--update");

function die(msg) {
  console.error(msg);
  process.exit(1);
}

try {
  switch (command) {
    case "init": {
      const result = runInit({ cwd: process.cwd(), templates, presetsDir, force, dryRun });
      if (result.dryRun) {
        console.log("Dry-run — pliki do skopiowania:");
        result.files.forEach((f) => console.log(`  ${f.from} → ${f.to}`));
      } else {
        result.results.forEach((r) => console.log(`✓ ${r}`));
        console.log(`
Toolkit migracji zainstalowany.

Komendy:  /migrate, /migrate-setup, /migrate-cr, /migrate-fix
Agenci:   migration-writer, migration-supervisor, migration-cr

Dostępne presety: ${result.presets.length ? result.presets.join(", ") : "(brak)"}
Załaduj preset:   claude-migrate preset ${result.presets[0] || "<nazwa>"}
`);
      }
      break;
    }

    case "preset": {
      const presetName = args.find((a) => !a.startsWith("--"));
      const result = runPreset({ presetName, presetsDir, cwd: process.cwd(), force, dryRun, update });

      if (result.list) {
        console.log("Dostępne presety:");
        result.presets.forEach((p) => console.log(`  - ${p}`));
        console.log(`\nUżycie: claude-migrate preset <nazwa> [--force] [--update]`);
      } else if (result.upToDate) {
        console.log(`Preset "${result.presetName}" jest aktualny (v${result.version}).`);
      } else if (result.dryRun) {
        console.log("Dry-run — pliki do skopiowania:");
        result.files.forEach((f) => console.log(`  ${f.from} → ${f.to}`));
      } else {
        result.results.forEach((r) => console.log(`✓ ${r}`));
        const versionInfo = result.version ? ` (v${result.version})` : "";
        console.log(`
Preset "${result.presetName}"${versionInfo} załadowany.

Plik presetu: .claude/migrate.preset.md
Gotowe do migracji: /migrate <plik-źródłowy> --propose
`);
      }
      break;
    }

    case "presets": {
      const presets = listPresets(presetsDir);
      if (presets.length === 0) {
        console.log("Brak dostępnych presetów.");
      } else {
        console.log("Dostępne presety:");
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
Claude Migrate v${pkg.version} — Uniwersalny toolkit migracji

Użycie:
  claude-migrate init                     instaluje agentów i komendy w projekcie
  claude-migrate init --force             nadpisuje istniejące pliki
  claude-migrate init --dry-run           podgląd co zostanie skopiowane
  claude-migrate preset <nazwa>           ładuje preset technologiczny
  claude-migrate preset <nazwa> --force   nadpisuje istniejący preset
  claude-migrate preset <nazwa> --update  aktualizuje preset do najnowszej wersji
  claude-migrate preset <nazwa> --dry-run podgląd co zostanie skopiowane
  claude-migrate presets                  lista dostępnych presetów
  claude-migrate --version               wersja paczki
`);
      process.exit(command ? 1 : 0);
  }
} catch (err) {
  die(err.message);
}
