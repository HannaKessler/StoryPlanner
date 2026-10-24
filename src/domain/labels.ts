import type { StoryNodeType } from "./types";

export const NODE_LABEL: Record<StoryNodeType, string> = {
  start: "Start",
  event: "Event",
  scene: "Scene",
  dialogue: "Dialogue",
  end: "End",
};

export function kindLabel(kind: string): string {
  if (kind === "boolean") return "Boolean";
  if (kind === "value") return "Value";
  if (kind === "tag") return "Tag";
  return kind;
}
