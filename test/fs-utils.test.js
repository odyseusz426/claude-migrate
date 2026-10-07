import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { copy, listPresets, readPresetVersion } from "../lib/fs-utils.js";

const tmp = join(import.meta.dirname, ".tmp-fs-utils");

function setup() {
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
}

function teardown() {
  rmSync(tmp, { recursive: true, force: true });
}

describe("copy", () => {
  beforeEach(setup);
  afterEach(teardown);

  it("copies a file", () => {
    const src = join(tmp, "src.txt");
    const dst = join(tmp, "dst.txt");
    writeFileSync(src, "hello");

    const result = copy(src, dst);
    assert.ok(existsSync(dst));
    assert.ok(result.includes("→"));
  });

  it("copies a directory recursively", () => {
    const srcDir = join(tmp, "srcdir", "sub");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "a.txt"), "a");
    const dstDir = join(tmp, "dstdir");

    copy(join(tmp, "srcdir"), dstDir);
    assert.ok(existsSync(join(dstDir, "sub", "a.txt")));
  });

  it("throws when source does not exist", () => {
    assert.throws(() => copy(join(tmp, "nope"), join(tmp, "dst")), /Źródło nie znalezione/);
  });

  it("throws when target exists and force=false", () => {
    const src = join(tmp, "src.txt");
    const dst = join(tmp, "dst.txt");
    writeFileSync(src, "a");
    writeFileSync(dst, "b");

    assert.throws(() => copy(src, dst), /Cel już istnieje/);
  });

  it("overwrites when force=true", () => {
    const src = join(tmp, "src.txt");
    const dst = join(tmp, "dst.txt");
    writeFileSync(src, "new");
    writeFileSync(dst, "old");

    copy(src, dst, { force: true });
    assert.ok(existsSync(dst));
  });

  it("uses custom label in result", () => {
    const src = join(tmp, "src.txt");
    const dst = join(tmp, "dst.txt");
    writeFileSync(src, "x");

    const result = copy(src, dst, { label: "my label" });
    assert.ok(result.startsWith("my label"));
  });
});

describe("listPresets", () => {
  beforeEach(setup);
  afterEach(teardown);

  it("returns empty array when dir does not exist", () => {
    assert.deepEqual(listPresets(join(tmp, "nonexistent")), []);
  });

  it("returns directory names only", () => {
    mkdirSync(join(tmp, "presets", "alpha"), { recursive: true });
    mkdirSync(join(tmp, "presets", "beta"), { recursive: true });
    writeFileSync(join(tmp, "presets", "file.txt"), "x");

    const result = listPresets(join(tmp, "presets"));
    assert.deepEqual(result.sort(), ["alpha", "beta"]);
  });
});

describe("readPresetVersion", () => {
  beforeEach(setup);
  afterEach(teardown);

  it("returns null when file does not exist", () => {
    assert.equal(readPresetVersion(join(tmp, "nope.md")), null);
  });

  it("returns null when no version line", () => {
    const f = join(tmp, "preset.md");
    writeFileSync(f, "# Preset\nSome content\n");
    assert.equal(readPresetVersion(f), null);
  });

  it("extracts version from preset_version line", () => {
    const f = join(tmp, "preset.md");
    writeFileSync(f, "# Preset\n\npreset_version: 2.1.0\n\nContent here\n");
    assert.equal(readPresetVersion(f), "2.1.0");
  });
});
