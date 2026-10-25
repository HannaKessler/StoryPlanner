import { createId } from "./ids";
import { SCHEMA_VERSION } from "./types";
import type {
  DialogueLine,
  Effect,
  GraphDocument,
  StoryEdge,
  StoryNode,
  StoryNodeType,
  Tag,
  TagCategory,
  VariableDef,
} from "./types";

export const TAG_COLORS = [
  "#e3a15a",
  "#8eb4c8",
  "#9cba92",
  "#d4897a",
  "#b7a4d6",
  "#d4c48a",
  "#7fafb0",
  "#c48b9f",
];

const TITLES: Record<StoryNodeType, string> = {
  start: "Start",
  event: "New event",
  scene: "New scene",
  dialogue: "New dialogue",
  end: "End",
};

export function createNode(type: StoryNodeType, partial: Partial<StoryNode> = {}): StoryNode {
  return {
    id: partial.id ?? createId(),
    type,
    position: partial.position ?? { x: 80, y: 160 },
    title: partial.title ?? TITLES[type],
    summary: partial.summary ?? "",
    sceneNotes: partial.sceneNotes ?? "",
    subgraphId: partial.subgraphId ?? null,
    tagIds: partial.tagIds ?? [],
    lines: partial.lines ?? [],
  };
}

export function createEdge(
  source: string,
  target: string,
  partial: Partial<StoryEdge> = {},
): StoryEdge {
  return {
    id: partial.id ?? createId(),
    source,
    target,
    label: partial.label ?? "",
    condition: partial.condition ?? null,
    effects: partial.effects ?? [],
  };
}

export function createLine(partial: Partial<DialogueLine> = {}): DialogueLine {
  return {
    id: partial.id ?? createId(),
    speakerTagId: partial.speakerTagId ?? null,
    text: partial.text ?? "",
    direction: partial.direction ?? "",
  };
}

export function createEffect(partial: Partial<Effect> = {}): Effect {
  return {
    id: partial.id ?? createId(),
    variableId: partial.variableId ?? "",
    op: partial.op ?? "set",
    value: partial.value ?? null,
  };
}

export function createVariable(kind: string, partial: Partial<VariableDef> = {}): VariableDef {
  const defaultValue =
    partial.defaultValue !== undefined
      ? partial.defaultValue
      : kind === "boolean"
        ? false
        : kind === "value"
          ? 0
          : null;
  return {
    id: partial.id ?? createId(),
    name: partial.name ?? "New variable",
    kind,
    description: partial.description ?? "",
    defaultValue,
    tagCategoryId: partial.tagCategoryId ?? null,
  };
}

export function createCategory(partial: Partial<TagCategory> = {}): TagCategory {
  return {
    id: partial.id ?? createId(),
    name: partial.name ?? "New category",
    isCharacters: partial.isCharacters ?? false,
    isLocations: partial.isLocations ?? false,
    description: partial.description ?? "",
    tags: partial.tags ?? [],
  };
}

export function createTag(name: string, index: number, partial: Partial<Tag> = {}): Tag {
  return {
    id: partial.id ?? createId(),
    name,
    description: partial.description ?? "",
    color: partial.color ?? TAG_COLORS[index % TAG_COLORS.length],
  };
}

export function createGraph(partial: Partial<GraphDocument> & { id?: string; name: string }): GraphDocument {
  return {
    schemaVersion: partial.schemaVersion ?? SCHEMA_VERSION,
    id: partial.id ?? createId(),
    name: partial.name,
    parentGraphId: partial.parentGraphId ?? null,
    parentNodeId: partial.parentNodeId ?? null,
    sceneNotes: partial.sceneNotes ?? "",
    nodes: partial.nodes ?? [],
    edges: partial.edges ?? [],
  };
}

export function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || target < 0 || index >= items.length || target >= items.length) return items;
  const next = items.slice();
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}
