import { appendCondition, defaultCompare } from "../domain/conditions";
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

/** Section menu: one Add entry per kind of condition. Choosing an entry inserts it. */
export function conditionAddItems(
  value: Condition | null,
  variableId: string,
  onChange: (next: Condition) => void,
): MenuItem[] {
  const addRule: MenuItem = {
    label: "Add rule",
    disabled: !variableId,
    onSelect: () => onChange(appendCondition(value, defaultCompare(variableId))),
  };
  const addHas: MenuItem = {
    label: "Add contains",
    disabled: !variableId,
    onSelect: () => onChange(appendCondition(value, { type: "has", variableId, entityId: "" })),
  };
  if (!value) {
    return [
      addRule,
      addHas,
      { label: "Add ALL group", onSelect: () => onChange({ type: "group", op: "and", children: [] }) },
      { label: "Add ANY group", onSelect: () => onChange({ type: "group", op: "or", children: [] }) },
    ];
  }
  const groupOp = value.type === "group" && value.op === "and" ? "or" : "and";
  return [
    addRule,
    addHas,
    {
      label: "Add group",
      onSelect: () => onChange(appendCondition(value, { type: "group", op: groupOp, children: [] })),
    },
  ];
}
