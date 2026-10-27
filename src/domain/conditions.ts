import { defaultForKind, entityName, formatValue, variableById } from "./format";
import type { CompareOp, Condition, ProjectDocument, VariableDef, VariableValue } from "./types";

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
  values: Record<string, VariableValue>,
  variables: VariableDef[],
): boolean {
  if (!condition) return true;
  return evaluateNode(condition, values, variables);
}

function evaluateNode(
  condition: Condition,
  values: Record<string, VariableValue>,
  variables: VariableDef[],
): boolean {
  if (condition.type === "group") {
    if (condition.op === "and") {
      return condition.children.every((child) => evaluateNode(child, values, variables));
    }
    return condition.children.some((child) => evaluateNode(child, values, variables));
  }
  if (condition.type === "not") return !evaluateNode(condition.child, values, variables);
  if (condition.type === "has") return evaluateHas(condition, values);
  return evaluateCompare(condition, values, variables);
}

function evaluateHas(
  condition: Extract<Condition, { type: "has" }>,
  values: Record<string, VariableValue>,
): boolean {
  if (!(condition.variableId in values)) return false;
  const current = values[condition.variableId];
  if (Array.isArray(current)) return current.includes(condition.entityId);
  return current === condition.entityId;
}

function evaluateCompare(
  condition: Extract<Condition, { type: "compare" }>,
  values: Record<string, VariableValue>,
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
  if (!condition.variableId) return "no variable";
  if (condition.type === "has") {
    const variable = variableById(project, condition.variableId);
    const name = variable?.name || "missing variable";
    return `${name} has ${entityName(project, condition.entityId)}`;
  }
  const variable = variableById(project, condition.variableId);
  const name = variable?.name || "missing variable";
  const value = formatValue(project, variable, condition.value);
  return `${name} ${OP_LABEL[condition.op]} ${value}`;
}

/** A new rule with no variable chosen. */
export function emptyRule(): Condition {
  return { type: "compare", variableId: "", op: "eq", value: null };
}

/**
 * A rule for a chosen variable. Inventories become `has` rules; every other
 * kind becomes a comparison whose value suits the kind.
 */
export function ruleForVariable(
  variable: VariableDef | undefined,
  previous?: Extract<Condition, { type: "compare" } | { type: "has" }>,
): Condition {
  if (!variable) return emptyRule();
  if (variable.kind === "inventory") {
    const entityId = previous?.type === "has" ? previous.entityId : "";
    return { type: "has", variableId: variable.id, entityId };
  }
  const allowed = opsForKind(variable.kind);
  const op = previous?.type === "compare" && allowed.includes(previous.op) ? previous.op : allowed[0];
  return { type: "compare", variableId: variable.id, op, value: defaultForKind(variable.kind) };
}

/** Kept for callers that start a rule on a known variable. */
export function defaultCompare(variableId = "", variables: VariableDef[] = []): Condition {
  if (!variableId) return emptyRule();
  return ruleForVariable(variables.find((item) => item.id === variableId));
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
