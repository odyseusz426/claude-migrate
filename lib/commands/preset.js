import { existsSync } from "node:fs";
import { join } from "node:path";
import { copy, listPresets, readPresetVersion } from "../fs-utils.js";

export function runPreset({ presetName, presetsDir, cwd, force, dryRun, update }) {
  if (!presetName) {
    const presets = listPresets(presetsDir);
    if (presets.length === 0) {
      throw new Error("Brak dostępnych presetów.");
    }
    return { list: true, presets };
  }

  const presetSrc = join(presetsDir, presetName);
  if (!existsSync(presetSrc)) {
    const available = listPresets(presetsDir);
    throw new Error(
      `Preset nie znaleziony: ${presetName}\nDostępne: ${available.join(", ") || "(brak)"}`
    );
  }

  const presetMd = join(presetSrc, "preset.md");
  const presetDst = join(cwd, ".claude", "migrate.preset.md");
  const refPatterns = join(presetSrc, "reference-patterns.md");
  const refDst = join(cwd, "ai", "reference-patterns", `${presetName}-patterns.md`);

  // Version check for --update
  if (update) {
    const srcVersion = readPresetVersion(presetMd);
    const dstVersion = readPresetVersion(presetDst);

    if (!srcVersion) {
      throw new Error(
        `Preset "${presetName}" nie ma wersji (brak preset_version w pliku). Użyj --force zamiast --update.`
      );
    }

    if (srcVersion === dstVersion) {
      return {
        list: false,
        upToDate: true,
        presetName,
        version: srcVersion,
      };
    }

    // Newer version available — force copy
    force = true;
  }

  if (dryRun) {
    const files = [];
    if (existsSync(presetMd)) files.push({ from: presetMd, to: presetDst });
    if (existsSync(refPatterns)) files.push({ from: refPatterns, to: refDst });
    return { list: false, dryRun: true, files };
  }

  const results = [];

  if (existsSync(presetMd)) {
    results.push(copy(presetMd, presetDst, { force, label: `preset: ${presetName}` }));
  }

  if (existsSync(refPatterns)) {
    results.push(copy(refPatterns, refDst, { force, label: "reference patterns" }));
  }

  const installedVersion = readPresetVersion(presetDst);

  return {
    list: false,
    dryRun: false,
    presetName,
    results,
    version: installedVersion,
  };
}
