import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { runInit } from "../lib/commands/init.js";

const tmp = join(import.meta.dirname, ".tmp-init");

function setup() {
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
}

function teardown() {
  rmSync(tmp, { recursive: true, force: true });
}

function makeFakeTemplates() {
  const tpl = join(tmp, "templates");
  mkdirSync(join(tpl, ".claude", "agents"), { recursive: true });
  mkdirSync(join(tpl, ".claude", "commands"), { recursive: true });
  writeFileSync(join(tpl, ".claude", "agents", "writer.md"), "agent");
  writeFileSync(join(tpl, ".claude", "commands", "migrate.md"), "cmd");
  return tpl;
}

function makeFakeSdd(cwd) {
  mkdirSync(join(cwd, ".claude"), { recursive: true });
  writeFileSync(join(cwd, ".claude", "CLAUDE.md"), "sdd");
}

describe("runInit", () => {
  beforeEach(setup);
  afterEach(teardown);

  it("throws when SDD is not installed", () => {
    const cwd = join(tmp, "project");
    mkdirSync(cwd, { recursive: true });
    const templates = makeFakeTemplates();

    assert.throws(
      () => runInit({ cwd, templates, presetsDir: join(tmp, "presets"), force: false, dryRun: false }),
      /nie jest zainstalowany/
    );
  });

  it("copies agents and commands in normal mode", () => {
    const cwd = join(tmp, "project");
    mkdirSync(cwd, { recursive: true });
    makeFakeSdd(cwd);
    const templates = makeFakeTemplates();

    const result = runInit({ cwd, templates, presetsDir: join(tmp, "presets"), force: false, dryRun: false });

    assert.equal(result.dryRun, false);
    assert.equal(result.results.length, 2);
    assert.ok(existsSync(join(cwd, ".claude", "agents", "writer.md")));
    assert.ok(existsSync(join(cwd, ".claude", "commands", "migrate.md")));
  });

  it("returns file list in dry-run mode", () => {
    const cwd = join(tmp, "project");
    mkdirSync(cwd, { recursive: true });
    makeFakeSdd(cwd);
    const templates = makeFakeTemplates();

    const result = runInit({ cwd, templates, presetsDir: join(tmp, "presets"), force: false, dryRun: true });

    assert.equal(result.dryRun, true);
    assert.equal(result.files.length, 2);
    assert.ok(!existsSync(join(cwd, ".claude", "agents", "writer.md")));
  });
});
