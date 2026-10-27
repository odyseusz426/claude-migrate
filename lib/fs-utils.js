import { cpSync, copyFileSync, existsSync, readdirSync, readFileSync, symlinkSync, lstatSync, unlinkSync, statSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const isWin = process.platform === "win32";

/**
 * Cross-platform link: symlink on macOS/Linux, junction (dir) or copy (file) on Windows.
 */
export function portableLink(target, linkPath, { force = false } = {}) {
  try {
    const stat = lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      if (force) unlinkSync(linkPath);
      else return "exists";
    } else if (stat.isDirectory() || stat.isFile()) {
      if (!force) return "real";
      if (isWin) {
        cpSync(target, linkPath, { recursive: true, force: true });
        return "copied";
      }
    }
  } catch { /* doesn't exist */ }

  if (isWin) {
    try {
      if (statSync(target).isDirectory()) {
        symlinkSync(target, linkPath, "junction");
        return "linked";
      }
    } catch { /* */ }
    mkdirSync(dirname(linkPath), { recursive: true });
    copyFileSync(target, linkPath);
    return "copied";
  }

  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath);
  return "linked";
}

/**
 * Link all files from srcDir into dstDir (individual file links, not directory link).
 */
export function linkDir(srcDir, dstDir, { force = false, label } = {}) {
  if (!existsSync(srcDir)) {
    throw new Error(`Źródło nie znalezione: ${srcDir}`);
  }
  if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true });

  let count = 0;
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const src = `${srcDir}/${entry.name}`;
    const dst = `${dstDir}/${entry.name}`;
    if (entry.isDirectory()) {
      linkDir(src, dst, { force });
    } else {
      portableLink(src, dst, { force });
    }
    count++;
  }
  return `${label || srcDir} → ${dstDir} (${count} plików)${force ? " (nadpisano)" : ""}`;
}

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
