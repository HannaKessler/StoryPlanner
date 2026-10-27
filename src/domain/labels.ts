import { speakerName } from "./format";
import type { ProjectDocument, StoryNode } from "./types";

/**
 * A label for lists and breadcrumbs. Uses the title when the writer set one.
 * Otherwise the first line, or a short id. Nothing here is saved.
 */
export function beatLabel(node: StoryNode, project?: ProjectDocument | null): string {
  const title = node.title.trim();
  if (title) return title;
  const line = node.lines.find((item) => item.text.trim() || item.speakerId);
  if (line) {
    const text = line.text.trim();
    const spoken = project
      ? `${speakerName(project, line.speakerId)}${text ? `: ${text}` : ""}`
      : text;
    if (spoken) return spoken;
  }
  return `Beat · ${node.id.slice(-6)}`;
}

export function kindLabel(kind: string): string {
  if (kind === "boolean") return "Boolean";
  if (kind === "value") return "Value";
  if (kind === "character") return "Character";
  if (kind === "item") return "Item";
  if (kind === "location") return "Location";
  if (kind === "inventory") return "Inventory";
  return kind;
}
