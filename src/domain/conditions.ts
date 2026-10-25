import { formatValue, variableById } from "./format";
import type { CompareOp, Condition, ProjectDocument, Scalar, VariableDef } from "./types";

const OP_LABEL: Record<CompareOp, string> = {
  eq: "is",
  neq: "is not",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
};

export function evaluateCondition(
  condition: Condition | null,
  values: Record<string, Scalar>,
  variables: VariableDef[],
): boolean {
  if (!condition) return true;
  return evaluateNode(condition, values, variables);
}

function evaluateNode(
  condition: Condition,
  values: Record<string, Scalar>,
  variables: VariableDef[],
): boolean {
  if (condition.type === "group") {
    if (condition.op === "and") {
      return condition.children.every((child) => evaluateNode(child, values, variables));
    }
    return condition.children.some((child) => evaluateNode(child, values, variables));
  }
  if (condition.type === "not") return !evaluateNode(condition.child, values, variables);
  return evaluateCompare(condition, values, variables);
}

function evaluateCompare(
  condition: Extract<Condition, { type: "compare" }>,
  values: Record<string, Scalar>,
  variables: VariableDef[],
): boolean {
  const variable = variables.find((item) => item.id === condition.variableId);
  if (!variable || !(variable.id in values)) return false;
  const current = values[variable.id];
  const expected = condition.value;
  if (typeof current === "number" && typeof expected === "number") {
    switch (condition.op) {
      case "eq":
        return current === expected;
      case "neq":
        return current !== expected;
      case "gt":
        return current > expected;
      case "gte":
        return current >= expected;
      case "lt":
        return current < expected;
      case "lte":
        return current <= expected;
      default:
        return false;
    }
  }
  if (condition.op === "eq") return Object.is(current, expected);
  if (condition.op === "neq") return !Object.is(current, expected);
  return false;
}

export function describeCondition(condition: Condition | null, project: ProjectDocument): string {
  if (!condition) return "Always";
  return describeNode(condition, project);
}

function describeNode(condition: Condition, project: ProjectDocument): string {
  if (condition.type === "group") {
    const label = condition.op === "and" ? "all of" : "any of";
    if (condition.children.length === 0) {
      return condition.op === "and" ? "all of (empty — passes)" : "any of (empty — fails)";
    }
    return `${label} (${condition.children.map((child) => describeNode(child, project)).join("; ")})`;
  }
  if (condition.type === "not") return `not (${describeNode(condition.child, project)})`;
  const variable = variableById(project, condition.variableId);
  const name = variable?.name || "missing variable";
  const value = formatValue(project, variable, condition.value);
  return `${name} ${OP_LABEL[condition.op]} ${value}`;
}

export function defaultCompare(variableId = ""): Condition {
  return { type: "compare", variableId, op: "eq", value: true };
}

/** Adds a child at the root. A rule or NOT root is wrapped in an ALL group first. */
export function appendCondition(root: Condition | null, child: Condition): Condition {
  if (!root) return child;
  if (root.type === "group") return { ...root, children: [...root.children, child] };
  return { type: "group", op: "and", children: [root, child] };
}

export function opsForKind(kind: string | undefined): CompareOp[] {
  if (kind === "value") return ["eq", "neq", "gt", "gte", "lt", "lte"];
  return ["eq", "neq"];
}

export function opLabel(op: keyof typeof OP_LABEL): string {
  return OP_LABEL[op];
}
