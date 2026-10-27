import { unassignPatch } from "../domain/assign";
import { appendCondition, emptyRule } from "../domain/conditions";
import { entityName } from "../domain/format";
import { nextBeatPosition } from "../domain/graphOps";
import type { Condition, EntityKind, StoryNode } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { focusRename, type MenuItem } from "./ContextMenu";
import { focusLine } from "./DialogueEditor";
import { openPopover } from "./Popover";

type Point = { x: number; y: number };

/** The canvas registers how to find the centre of the view in graph coordinates. */
let viewCenter: (() => Point | null) | null = null;

export function registerViewCenter(next: (() => Point | null) | null) {
  viewCenter = next;
}

/** Adds a beat next to the selected beat, or in the middle of the view, and selects it. */
export function addBeatInView() {
  const state = useProjectStore.getState();
  const graph = state.currentGraphId ? state.graphs[state.currentGraphId] : undefined;
  if (!graph) return;
  const selected = state.selection?.kind === "node" ? state.selection.id : null;
  state.addNode(nextBeatPosition(graph, selected, viewCenter?.() ?? null));
}

export function addBeatItems(position?: Point, partial?: Partial<Pick<StoryNode, "locationId" | "locationPosition">>): MenuItem[] {
  return [
    {
      label: "Add event",
      onSelect: () => (position || partial ? useProjectStore.getState().addNode(position, partial) : addBeatInView()),
    },
  ];
}

function currentNode(nodeId: string): StoryNode | undefined {
  const state = useProjectStore.getState();
  return state.currentGraphId ? state.graphs[state.currentGraphId]?.nodes.find((item) => item.id === nodeId) : undefined;
}

/** Add and remove entries for what an event lists. `at` is where a quick-create field opens. */
export function assignItems(nodeId: string, at: Point): MenuItem[] {
  const state = useProjectStore.getState();
  const node = currentNode(nodeId);
  const project = state.project;
  if (!node || !project) return [];
  const add = (entity: EntityKind) => () => openPopover(at.x, at.y, { kind: "entity", nodeId, entity });
  const remove = (entity: EntityKind, id: string): MenuItem => ({
    label: `Remove ${entityName(project, id)}`,
    onSelect: () => {
      const fresh = currentNode(nodeId);
      if (fresh) useProjectStore.getState().updateNode(nodeId, unassignPatch(fresh, entity, id));
    },
  });
  const removals: MenuItem[] = [
    ...(node.locationId ? [remove("location", node.locationId)] : []),
    ...node.characterIds.map((id) => remove("character", id)),
    ...node.itemIds.map((id) => remove("item", id)),
  ];
  return [
    { label: "Add character…", onSelect: add("character") },
    { label: "Add item…", onSelect: add("item") },
    { label: node.locationId ? "Change location…" : "Set location…", onSelect: add("location") },
    ...(removals.length > 0 ? ["separator" as const, ...removals] : []),
  ];
}

/** The one right-click menu for an event, on the canvas and in the outline. */
export function beatItems(node: Pick<StoryNode, "id" | "subgraphId">, at: Point): MenuItem[] {
  const state = useProjectStore.getState();
  const exists = Boolean(node.subgraphId && state.graphs[node.subgraphId]);
  const fresh = currentNode(node.id);
  const noVariables = (state.project?.variables.length ?? 0) === 0;
  return [
    exists
      ? { label: "Open", onSelect: () => state.openSubgraph(node.id) }
      : { label: "Add children", onSelect: () => state.createSubgraph(node.id) },
    ...(exists ? [{ label: "Remove children", danger: true, onSelect: () => state.requestDeleteSubgraph(node.id) }] : []),
    "separator",
    ...assignItems(node.id, at),
    "separator",
    {
      label: "Add line",
      onSelect: () => {
        const store = useProjectStore.getState();
        store.select({ kind: "node", id: node.id });
        store.setEditMode("write");
        focusLine(store.addLine(node.id));
      },
    },
    {
      label: fresh && fresh.effects.length > 0 ? "Edit effects…" : "Add effect…",
      disabled: noVariables && !(fresh && fresh.effects.length > 0),
      onSelect: () => {
        const current = currentNode(node.id);
        if (current && current.effects.length === 0) useProjectStore.getState().addNodeEffect(node.id);
        openPopover(at.x, at.y, { kind: "effects", nodeId: node.id });
      },
    },
    "separator",
    {
      label: "Rename",
      onSelect: () => {
        state.select({ kind: "node", id: node.id });
        focusRename(node.id);
      },
    },
    { label: "Duplicate", onSelect: () => state.duplicateNode(node.id) },
    "separator",
    { label: "Delete", danger: true, onSelect: () => state.requestDeleteNodes([node.id]) },
  ];
}

/** Right-click menu for an existing transition. */
export function edgeItems(edgeId: string, at: Point): MenuItem[] {
  const state = useProjectStore.getState();
  const graph = state.currentGraphId ? state.graphs[state.currentGraphId] : undefined;
  const edge = graph?.edges.find((item) => item.id === edgeId);
  const reverseExists = Boolean(edge && graph?.edges.some((item) => item.source === edge.target && item.target === edge.source));
  const hasCondition = Boolean(edge?.condition);
  const noVariables = (state.project?.variables.length ?? 0) === 0;
  return [
    {
      label: hasCondition ? "Edit condition…" : "Add condition…",
      onSelect: () => {
        // A new condition starts with one rule to fill in, when there is a variable to test.
        if (!hasCondition && !noVariables) useProjectStore.getState().updateEdge(edgeId, { condition: appendCondition(null, emptyRule()) });
        openPopover(at.x, at.y, { kind: "condition", edgeId });
      },
    },
    ...(hasCondition ? [{ label: "Remove condition", onSelect: () => useProjectStore.getState().updateEdge(edgeId, { condition: null }) }] : []),
    "separator",
    { label: "Add reverse transition", disabled: reverseExists, onSelect: () => state.addReverseTransition(edgeId) },
    { label: "Insert event", onSelect: () => state.insertBeatOnEdge(edgeId) },
    "separator",
    { label: "Delete", danger: true, onSelect: () => state.deleteEdges([edgeId]) },
  ];
}

/** Section menu for conditions. Choosing an entry inserts it; a single rule root is wrapped in an ALL group. */
export function conditionAddItems(
  value: Condition | null,
  hasVariables: boolean,
  onChange: (next: Condition) => void,
): MenuItem[] {
  return [
    { label: "Add rule", disabled: !hasVariables, onSelect: () => onChange(appendCondition(value, emptyRule())) },
    { label: "Add all of", onSelect: () => onChange(appendCondition(value, { type: "group", op: "and", children: [] })) },
    { label: "Add any of", onSelect: () => onChange(appendCondition(value, { type: "group", op: "or", children: [] })) },
  ];
}
