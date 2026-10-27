import { createId } from "./ids";
import { SCHEMA_VERSION } from "./types";
import type {
  DialogueLine,
  Effect,
  EntityField,
  GraphDocument,
  StoryEdge,
  StoryEntity,
  StoryNode,
  VariableDef,
} from "./types";

export function createNode(partial: Partial<StoryNode> = {}): StoryNode {
  return {
    id: partial.id ?? createId(),
    type: "beat",
    number: partial.number ?? 0,
    position: partial.position ?? { x: 80, y: 160 },
    title: partial.title ?? "",
    summary: partial.summary ?? "",
    sceneNotes: partial.sceneNotes ?? "",
    subgraphId: partial.subgraphId ?? null,
    locationId: partial.locationId ?? null,
    characterIds: partial.characterIds ?? [],
    itemIds: partial.itemIds ?? [],
    locationPosition: partial.locationPosition ?? null,
    lines: partial.lines ?? [],
    effects: partial.effects ?? [],
  };
}

export function createEntity(partial: Partial<StoryEntity> = {}): StoryEntity {
  return {
    id: partial.id ?? createId(),
    name: partial.name ?? "",
    notes: partial.notes ?? "",
    images: partial.images ?? [],
    fields: partial.fields ?? [],
  };
}

export function createField(partial: Partial<EntityField> = {}): EntityField {
  return { key: partial.key ?? "", value: partial.value ?? "" };
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
  };
}

export function createLine(partial: Partial<DialogueLine> = {}): DialogueLine {
  return {
    id: partial.id ?? createId(),
    speakerId: partial.speakerId ?? null,
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
  return {
    id: partial.id ?? createId(),
    name: partial.name ?? "",
    kind,
    description: partial.description ?? "",
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
    locationBoxes: partial.locationBoxes ?? [],
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
