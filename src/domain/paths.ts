/** Join path segments with `/`. Rust accepts these on Windows as well. */
export function joinPath(...parts: string[]): string {
  const cleaned = parts
    .filter((part) => part.length > 0)
    .map((part, index) => {
      const slashed = part.replace(/\\/g, "/");
      if (index === 0) return slashed.replace(/\/+$/, "");
      return slashed.replace(/^\/+|\/+$/g, "");
    });
  return cleaned.join("/");
}

export function normalizePath(path: string): string {
  const slashed = path.replace(/\\/g, "/");
  const drive = slashed.match(/^([A-Za-z]:)(.*)$/);
  const prefix = drive?.[1] ?? "";
  const rest = drive ? drive[2] : slashed;
  const absolute = rest.startsWith("/");
  const segments: string[] = [];
  for (const part of rest.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") segments.pop();
    else segments.push(part);
  }
  return prefix + (absolute ? "/" : "") + segments.join("/");
}

export function graphFileName(graphId: string): string {
  return `${graphId}.json`;
}
