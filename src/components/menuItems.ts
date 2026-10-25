import { appendCondition, defaultCompare } from "../domain/conditions";
import { addableNodeTypes, PLACED_BEAT_TYPES } from "../domain/graphOps";
import { NODE_LABEL } from "../domain/labels";
import type { Condition, GraphDocument } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import type { MenuItem } from "./ContextMenu";

export function addBeatItems(graph: GraphDocument, position?: { x: number; y: number }): MenuItem[] {
  return addableNodeTypes(graph).map((type) => ({
    label: `Add ${NODE_LABEL[type].toLowerCase()}`,
    onSelect: () => useProjectStore.getState().addNode(type, position),
  }));
}

/** Menu shown when a connection is dropped on empty canvas. Choosing an entry creates and connects the beat. */
export function connectBeatItems(sourceId: string, position: { x: number; y: number }): MenuItem[] {
  return PLACED_BEAT_TYPES.map((type) => ({
    label: `Add ${NODE_LABEL[type].toLowerCase()}`,
    onSelect: () => useProjectStore.getState().addConnectedNode(sourceId, type, position),
  }));
}

/** Right-click menu for an existing transition. */
export function edgeItems(edgeId: string): MenuItem[] {
  return [
    { label: "Add transition", onSelect: () => useProjectStore.getState().addParallelTransition(edgeId) },
    "separator",
    ...PLACED_BEAT_TYPES.map((type) => ({
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
