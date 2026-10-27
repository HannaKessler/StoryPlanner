import { appendCondition, emptyRule } from "../domain/conditions";
import type { Condition, StoryNode } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import type { MenuItem } from "./ContextMenu";

export function addBeatItems(position?: { x: number; y: number }): MenuItem[] {
  return [{ label: "Add beat", onSelect: () => useProjectStore.getState().addNode(position) }];
}

/** Menu shown when a connection is dropped on empty canvas. */
export function connectBeatItems(sourceId: string, position: { x: number; y: number }): MenuItem[] {
  return [{ label: "Add beat", onSelect: () => useProjectStore.getState().addConnectedNode(sourceId, position) }];
}

/** Right-click menu for a beat. Creating a sub-graph is only this action. */
export function nodeGraphItems(node: Pick<StoryNode, "id" | "subgraphId">): MenuItem[] {
  const state = useProjectStore.getState();
  const exists = Boolean(node.subgraphId && state.graphs[node.subgraphId]);
  if (exists) {
    return [{ label: "Open", onSelect: () => state.openSubgraph(node.id) }];
  }
  return [{ label: "Create sub-graph", onSelect: () => state.createSubgraph(node.id) }];
}

/** Right-click menu for an existing transition. */
export function edgeItems(edgeId: string): MenuItem[] {
  return [
    { label: "Add transition", onSelect: () => useProjectStore.getState().addParallelTransition(edgeId) },
    "separator",
    { label: "Insert beat", onSelect: () => useProjectStore.getState().insertBeatOnEdge(edgeId) },
    "separator",
    { label: "Delete", danger: true, onSelect: () => useProjectStore.getState().deleteEdges([edgeId]) },
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
