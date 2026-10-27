import { appendCondition, emptyRule } from "../domain/conditions";
import type { Condition, StoryNode } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { focusRename, type MenuItem } from "./ContextMenu";

export function addBeatItems(position?: { x: number; y: number }): MenuItem[] {
  return [{ label: "Add beat", onSelect: () => useProjectStore.getState().addNode(position) }];
}

/** Menu shown when a connection is dropped on empty canvas. */
export function connectBeatItems(sourceId: string, position: { x: number; y: number }): MenuItem[] {
  return [{ label: "Add beat", onSelect: () => useProjectStore.getState().addConnectedNode(sourceId, position) }];
}

/** The one right-click menu for a beat, on the canvas and in the beat list. */
export function beatItems(node: Pick<StoryNode, "id" | "subgraphId">): MenuItem[] {
  const state = useProjectStore.getState();
  const exists = Boolean(node.subgraphId && state.graphs[node.subgraphId]);
  return [
    exists
      ? { label: "Open", onSelect: () => state.openSubgraph(node.id) }
      : { label: "Create sub-graph", onSelect: () => state.createSubgraph(node.id) },
    ...(exists ? [{ label: "Remove sub-graph", danger: true, onSelect: () => state.requestDeleteSubgraph(node.id) }] : []),
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
