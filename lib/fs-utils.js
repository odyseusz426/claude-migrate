import { cpSync, existsSync, readdirSync, readFileSync } from "node:fs";

export function copy(from, to, { force = false, label } = {}) {
  if (!existsSync(from)) {
    throw new Error(`Źródło nie znalezione: ${from}`);
  }
  if (existsSync(to) && !force) {
    throw new Error(
      `Cel już istnieje: ${to}\nUżyj --force żeby nadpisać.`
    );
  }
  cpSync(from, to, { recursive: true, force });
  return `${label || from} → ${to}${force ? " (nadpisano)" : ""}`;
}

export function listPresets(presetsDir) {
  if (!existsSync(presetsDir)) return [];
  return readdirSync(presetsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

export function readPresetVersion(presetMdPath) {
  if (!existsSync(presetMdPath)) return null;
  const content = readFileSync(presetMdPath, "utf8");
  const match = content.match(/^preset_version:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}
