export function sanitizeFilename(name: string, fallback = "untitled-project"): string {
  const sanitized = name
    .normalize("NFKD")
    .replace(/[<>:"/\\|?*]/g, "-")
    .split("")
    .map((character) => (character.charCodeAt(0) < 32 ? "-" : character))
    .join("")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/\.+$/, "")
    .toLowerCase()
    .slice(0, 96);

  if (!sanitized || isWindowsReservedName(sanitized)) {
    return fallback;
  }

  return sanitized;
}

function isWindowsReservedName(name: string): boolean {
  const baseName = name.split(".")[0];
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(baseName ?? "");
}
