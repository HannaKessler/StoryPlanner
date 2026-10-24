import { formatValue, variableById } from "./format";
import type { Effect, ProjectDocument, Scalar, VariableDef } from "./types";

export function defaultValues(variables: VariableDef[]): Record<string, Scalar> {
  const values: Record<string, Scalar> = {};
  for (const variable of variables) values[variable.id] = variable.defaultValue;
  return values;
}

export function applyEffect(
  values: Record<string, Scalar>,
  effect: Effect,
  variables: VariableDef[],
): Record<string, Scalar> {
  const variable = variables.find((item) => item.id === effect.variableId);
  if (!variable) return values;
  const current = values[variable.id];
  let next: Scalar | undefined;
  switch (effect.op) {
    case "set":
      next = coerce(variable, effect.value);
      break;
    case "add":
      if (typeof current === "number" && typeof effect.value === "number") next = current + effect.value;
      break;
    case "toggle":
      if (typeof current === "boolean") next = !current;
      break;
    case "clear":
      if (variable.kind === "boolean") next = false;
      else if (variable.kind === "value") next = 0;
      else next = null;
      break;
    default:
      break;
  }
  if (next === undefined) return values;
  return { ...values, [variable.id]: next };
}

export function applyEffects(
  values: Record<string, Scalar>,
  effects: Effect[],
  variables: VariableDef[],
): Record<string, Scalar> {
  return effects.reduce((current, effect) => applyEffect(current, effect, variables), values);
}

function coerce(variable: VariableDef, value: Scalar): Scalar | undefined {
  if (variable.kind === "boolean") return typeof value === "boolean" ? value : undefined;
  if (variable.kind === "value") return typeof value === "number" ? value : undefined;
  if (variable.kind === "tag") return value === null || typeof value === "string" ? value : undefined;
  return value;
}

export function describeEffect(effect: Effect, project: ProjectDocument): string {
  const variable = variableById(project, effect.variableId);
  const name = variable?.name || "missing variable";
  if (effect.op === "set") return `set ${name} to ${formatValue(project, variable, effect.value)}`;
  if (effect.op === "add") {
    const amount = typeof effect.value === "number" ? effect.value : 0;
    return amount < 0 ? `subtract ${Math.abs(amount)} from ${name}` : `add ${amount} to ${name}`;
  }
  if (effect.op === "toggle") return `toggle ${name}`;
  return `clear ${name}`;
}

export function opsForVariable(kind: string | undefined): Effect["op"][] {
  if (kind === "boolean") return ["set", "toggle"];
  if (kind === "value") return ["set", "add"];
  if (kind === "tag") return ["set", "clear"];
  return ["set", "clear"];
}
