import { appendCondition, defaultCompare } from "../domain/conditions";
import { BEAT_TYPES, canOwnInnerGraph } from "../domain/graphOps";
import { NODE_LABEL } from "../domain/labels";
import type { Condition, StoryNode } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import type { MenuItem } from "./ContextMenu";

export function addBeatItems(position?: { x: number; y: number }): MenuItem[] {
  return BEAT_TYPES.map((type) => ({
    label: `Add ${NODE_LABEL[type].toLowerCase()}`,
    onSelect: () => useProjectStore.getState().addNode(type, position),
  }));
}

/** Menu shown when a connection is dropped on empty canvas. Choosing an entry creates and connects the beat. */
export function connectBeatItems(sourceId: string, position: { x: number; y: number }): MenuItem[] {
  return BEAT_TYPES.map((type) => ({
    label: `Add ${NODE_LABEL[type].toLowerCase()}`,
    onSelect: () => useProjectStore.getState().addConnectedNode(sourceId, type, position),
  }));
}

/** Right-click menu for a beat. Creating a sub-graph is only this action. */
export function nodeGraphItems(node: Pick<StoryNode, "id" | "type" | "subgraphId">): MenuItem[] {
  const state = useProjectStore.getState();
  const exists = Boolean(node.subgraphId && state.graphs[node.subgraphId]);
  if (exists) {
    return [{ label: "Open sub-graph", onSelect: () => state.openSubgraph(node.id) }];
  }
  if (!canOwnInnerGraph(node.type)) return [];
  return [{ label: "Create sub-graph", onSelect: () => state.createSubgraph(node.id) }];
}

/** Right-click menu for an existing transition. */
export function edgeItems(edgeId: string): MenuItem[] {
  return [
    { label: "Add transition", onSelect: () => useProjectStore.getState().addParallelTransition(edgeId) },
    "separator",
    ...BEAT_TYPES.map((type) => ({
      label: `Insert ${NODE_LABEL[type].toLowerCase()}`,
      onSelect: () => useProjectStore.getState().insertBeatOnEdge(edgeId, type),
    })),
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
  if (!value) {
    return [
      addRule,
      { label: "Add ALL group", onSelect: () => onChange({ type: "group", op: "and", children: [] }) },
      { label: "Add ANY group", onSelect: () => onChange({ type: "group", op: "or", children: [] }) },
    ];
  }
  const groupOp = value.type === "group" && value.op === "and" ? "or" : "and";
  return [
    addRule,
    {
      label: "Add group",
      onSelect: () => onChange(appendCondition(value, { type: "group", op: groupOp, children: [] })),
    },
  ];
}
