import { copyFile, pickImages } from "../desktop/tauri";
import { joinPath } from "./paths";

/** Copies chosen images into `assets/<entityId>/` and returns the relative paths. */
export async function copyImagesIntoProject(projectPath: string, entityId: string, existing: string[]): Promise<string[]> {
  const picked = await pickImages();
  if (!picked || picked.length === 0) return [];
  const used = new Set(existing.map((path) => path.split("/").pop()));
  const added: string[] = [];
  for (const source of picked) {
    const original = source.split(/[/\\]/).pop() ?? "image";
    const safe = original.replace(/[^a-zA-Z0-9._-]/g, "_") || "image";
    let name = safe;
    let n = 2;
    while (used.has(name)) {
      const dot = safe.lastIndexOf(".");
      name = dot > 0 ? `${safe.slice(0, dot)}-${n}${safe.slice(dot)}` : `${safe}-${n}`;
      n += 1;
    }
    used.add(name);
    const relative = `assets/${entityId}/${name}`;
    await copyFile(source, joinPath(projectPath, relative));
    added.push(relative);
  }
  return added;
}
