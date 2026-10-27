import { appendCondition, emptyRule } from "../domain/conditions";
import { nextBeatPosition } from "../domain/graphOps";
import type { Condition, StoryNode } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { focusRename, type MenuItem } from "./ContextMenu";

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
      label: "Add beat",
      onSelect: () => (position || partial ? useProjectStore.getState().addNode(position, partial) : addBeatInView()),
    },
  ];
}

/** The one right-click menu for a beat, on the canvas and in the beat list. */
export function beatItems(node: Pick<StoryNode, "id" | "subgraphId">): MenuItem[] {
  const state = useProjectStore.getState();
  const exists = Boolean(node.subgraphId && state.graphs[node.subgraphId]);
  return [
    exists
      ? { label: "Open", onSelect: () => state.openSubgraph(node.id) }
      : { label: "Add children", onSelect: () => state.createSubgraph(node.id) },
    ...(exists ? [{ label: "Remove children", danger: true, onSelect: () => state.requestDeleteSubgraph(node.id) }] : []),
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
export function edgeItems(edgeId: string): MenuItem[] {
  const state = useProjectStore.getState();
  const graph = state.currentGraphId ? state.graphs[state.currentGraphId] : undefined;
  const edge = graph?.edges.find((item) => item.id === edgeId);
  const reverseExists = Boolean(edge && graph?.edges.some((item) => item.source === edge.target && item.target === edge.source));
  return [
    { label: "Add reverse transition", disabled: reverseExists, onSelect: () => state.addReverseTransition(edgeId) },
    { label: "Insert beat", onSelect: () => state.insertBeatOnEdge(edgeId) },
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
