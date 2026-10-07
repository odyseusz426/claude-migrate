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
    console.error(`Źródło nie znalezione: ${from}`);
    process.exit(1);
  }
  if (existsSync(to) && !force) {
    console.error(`Cel już istnieje: ${to}`);
    console.error(`Użyj --force żeby nadpisać.`);
    process.exit(1);
  }
  cpSync(from, to, { recursive: true, force });
  console.log(`\u2713 ${label || from} \u2192 ${to}${force ? " (nadpisano)" : ""}`);
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
Toolkit migracji zainstalowany.

Komendy:  /migrate, /migrate-setup, /migrate-cr, /migrate-fix
Agenci:   migration-analyzer, migration-writer, migration-supervisor, migration-cr

Dostępne presety: ${presets.length ? presets.join(", ") : "(brak)"}
Załaduj preset:   claude-migrate preset ${presets[0] || "<nazwa>"}
`);
    break;
  }

  case "preset": {
    const presetName = args.find((a) => !a.startsWith("--"));
    if (!presetName) {
      const presets = listPresets();
      if (presets.length === 0) {
        console.error("Brak dostępnych presetów.");
        process.exit(1);
      }
      console.log("Dostępne presety:");
      presets.forEach((p) => console.log(`  - ${p}`));
      console.log(`\nUżycie: claude-migrate preset <nazwa> [--force]`);
      process.exit(0);
    }

    const presetSrc = join(presetsDir, presetName);
    if (!existsSync(presetSrc)) {
      console.error(`Preset nie znaleziony: ${presetName}`);
      console.error(`Dostępne: ${listPresets().join(", ") || "(brak)"}`);
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
Preset "${presetName}" załadowany.

Plik presetu: .claude/migrate.preset.md
Gotowe do migracji: /migrate <plik-źródłowy> --propose
`);
    break;
  }

  case "presets": {
    const presets = listPresets();
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
Claude Migrate v${pkg.version} \u2014 Uniwersalny toolkit migracji

Użycie:
  claude-migrate init                     instaluje agentów i komendy w projekcie
  claude-migrate init --force             nadpisuje istniejące pliki
  claude-migrate preset <nazwa>           ładuje preset technologiczny
  claude-migrate preset <nazwa> --force   nadpisuje istniejący preset
  claude-migrate presets                  lista dostępnych presetów
  claude-migrate --version               wersja paczki
`);
    process.exit(command ? 1 : 0);
}
