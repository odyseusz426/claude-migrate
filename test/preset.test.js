import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runPreset } from "../lib/commands/preset.js";

const tmp = join(import.meta.dirname, ".tmp-preset");

function setup() {
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
}

function teardown() {
  rmSync(tmp, { recursive: true, force: true });
}

function makePreset(name, { version } = {}) {
  const dir = join(tmp, "presets", name);
  mkdirSync(dir, { recursive: true });
  const vLine = version ? `\npreset_version: ${version}\n` : "";
  writeFileSync(join(dir, "preset.md"), `# Preset: ${name}${vLine}\nContent\n`);
  return dir;
}

function makeCwd() {
  const cwd = join(tmp, "project");
  mkdirSync(join(cwd, ".claude"), { recursive: true });
  return cwd;
}

describe("runPreset", () => {
  beforeEach(setup);
  afterEach(teardown);

  it("lists presets when no name given", () => {
    makePreset("alpha");
    makePreset("beta");
    const result = runPreset({ presetName: null, presetsDir: join(tmp, "presets"), cwd: makeCwd() });
    assert.equal(result.list, true);
    assert.ok(result.presets.includes("alpha"));
    assert.ok(result.presets.includes("beta"));
  });

  it("throws when no presets exist and no name", () => {
    assert.throws(
      () => runPreset({ presetName: null, presetsDir: join(tmp, "presets"), cwd: makeCwd() }),
      /Brak dostępnych presetów/
    );
  });

  it("throws when preset not found", () => {
    makePreset("exists");
    assert.throws(
      () => runPreset({ presetName: "nope", presetsDir: join(tmp, "presets"), cwd: makeCwd() }),
      /Preset nie znaleziony: nope/
    );
  });

  it("copies preset files", () => {
    makePreset("my-preset", { version: "1.0.0" });
    const cwd = makeCwd();
    const result = runPreset({ presetName: "my-preset", presetsDir: join(tmp, "presets"), cwd });

    assert.equal(result.list, false);
    assert.equal(result.presetName, "my-preset");
    assert.equal(result.version, "1.0.0");
    assert.ok(existsSync(join(cwd, ".claude", "migrate.preset.md")));
  });

  it("dry-run returns files without copying", () => {
    makePreset("my-preset");
    const cwd = makeCwd();
    const result = runPreset({ presetName: "my-preset", presetsDir: join(tmp, "presets"), cwd, dryRun: true });

    assert.equal(result.dryRun, true);
    assert.ok(result.files.length > 0);
    assert.ok(!existsSync(join(cwd, ".claude", "migrate.preset.md")));
  });

  it("--update reports up-to-date when versions match", () => {
    makePreset("vp", { version: "2.0.0" });
    const cwd = makeCwd();
    // Install first
    runPreset({ presetName: "vp", presetsDir: join(tmp, "presets"), cwd });
    // Update — same version
    const result = runPreset({ presetName: "vp", presetsDir: join(tmp, "presets"), cwd, update: true });
    assert.equal(result.upToDate, true);
    assert.equal(result.version, "2.0.0");
  });

  it("--update overwrites when version differs", () => {
    makePreset("vp", { version: "1.0.0" });
    const cwd = makeCwd();
    // Install v1
    runPreset({ presetName: "vp", presetsDir: join(tmp, "presets"), cwd });

    // Bump source to v2
    const presetMd = join(tmp, "presets", "vp", "preset.md");
    writeFileSync(presetMd, "# Preset: vp\n\npreset_version: 2.0.0\n\nNew content\n");

    const result = runPreset({ presetName: "vp", presetsDir: join(tmp, "presets"), cwd, update: true });
    assert.equal(result.version, "2.0.0");
    assert.ok(!result.upToDate);

    const installed = readFileSync(join(cwd, ".claude", "migrate.preset.md"), "utf8");
    assert.ok(installed.includes("New content"));
  });

  it("--update throws when source has no version", () => {
    makePreset("noversion");
    const cwd = makeCwd();
    assert.throws(
      () => runPreset({ presetName: "noversion", presetsDir: join(tmp, "presets"), cwd, update: true }),
      /nie ma wersji/
    );
  });
});
