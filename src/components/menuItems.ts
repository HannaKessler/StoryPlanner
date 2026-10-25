import { appendCondition, defaultCompare } from "../domain/conditions";
import { addableNodeTypes } from "../domain/graphOps";
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
