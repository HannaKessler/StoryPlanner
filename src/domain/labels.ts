import { speakerName } from "./format";
import type { ProjectDocument, StoryNode, StoryNodeType } from "./types";

export const NODE_LABEL: Record<StoryNodeType, string> = {
  start: "Start",
  event: "Event",
  scene: "Scene",
  dialogue: "Dialogue",
  end: "End",
};

/**
 * A label for lists and breadcrumbs. Uses the title when the writer set one.
 * Otherwise the type plus the first line, or a short id. Nothing here is saved.
 */
export function beatLabel(node: StoryNode, project?: ProjectDocument | null): string {
  const title = node.title.trim();
  if (title) return title;
  const line = node.lines.find((item) => item.text.trim() || item.speakerTagId);
  if (line) {
    const text = line.text.trim();
    const spoken = project
      ? `${speakerName(project, line.speakerTagId)}${text ? `: ${text}` : ""}`
      : text;
    if (spoken) return `${NODE_LABEL[node.type]} · ${spoken}`;
  }
  return `${NODE_LABEL[node.type]} · ${node.id.slice(-6)}`;
}

export function kindLabel(kind: string): string {
  if (kind === "boolean") return "Boolean";
  if (kind === "value") return "Value";
  if (kind === "tag") return "Tag";
  return kind;
}
