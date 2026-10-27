import { entityName, formatValue, variableById } from "./format";
import type { Effect, EffectOp, ProjectDocument, Scalar, VariableDef, VariableValue } from "./types";

export function defaultValues(variables: VariableDef[]): Record<string, VariableValue> {
  const values: Record<string, VariableValue> = {};
  for (const variable of variables) values[variable.id] = variable.defaultValue;
  return values;
}

export function applyEffect(
  values: Record<string, VariableValue>,
  effect: Effect,
  variables: VariableDef[],
): Record<string, VariableValue> {
  const variable = variables.find((item) => item.id === effect.variableId);
  if (!variable) return values;
  const current = values[variable.id];
  const next = nextValue(variable, current, effect);
  if (next === undefined) return values;
  return { ...values, [variable.id]: next };
}

export function applyEffects(
  values: Record<string, VariableValue>,
  effects: Effect[],
  variables: VariableDef[],
): Record<string, VariableValue> {
  return effects.reduce((current, effect) => applyEffect(current, effect, variables), values);
}

function nextValue(variable: VariableDef, current: VariableValue | undefined, effect: Effect): VariableValue | undefined {
  const kind = variable.kind;
  if (kind === "inventory" || Array.isArray(current)) {
    const list = Array.isArray(current) ? current : [];
    if (effect.op === "clear") return [];
    if (effect.op === "set") {
      if (effect.value === null) return [];
      return typeof effect.value === "string" && effect.value ? [effect.value] : undefined;
    }
    if (typeof effect.value !== "string" || !effect.value) return undefined;
    if (effect.op === "add") return list.includes(effect.value) ? list : [...list, effect.value];
    if (effect.op === "remove") return list.filter((id) => id !== effect.value);
    return undefined;
  }
  switch (effect.op) {
    case "set":
    case "add":
      if (kind === "value" && effect.op === "add") {
        return typeof current === "number" && typeof effect.value === "number" ? current + effect.value : undefined;
      }
      if (kind === "character" || kind === "item" || kind === "location") {
        return effect.value === null || typeof effect.value === "string" ? effect.value : undefined;
      }
      return coerce(variable, effect.value);
    case "remove":
      if (kind === "character" || kind === "item" || kind === "location") {
        if (effect.value === null || current === effect.value) return null;
      }
      return undefined;
    case "toggle":
      return typeof current === "boolean" ? !current : undefined;
    case "clear":
      if (kind === "boolean") return false;
      if (kind === "value") return 0;
      return null;
    default:
      return undefined;
  }
}

function coerce(variable: VariableDef, value: Scalar): Scalar | undefined {
  if (variable.kind === "boolean") return typeof value === "boolean" ? value : undefined;
  if (variable.kind === "value") return typeof value === "number" ? value : undefined;
  if (variable.kind === "character" || variable.kind === "item" || variable.kind === "location") {
    return value === null || typeof value === "string" ? value : undefined;
  }
  return value;
}

export function describeEffect(effect: Effect, project: ProjectDocument): string {
  const variable = variableById(project, effect.variableId);
  const name = variable?.name || "missing variable";
  if (variable?.kind === "inventory" || effect.op === "remove") {
    const what = typeof effect.value === "string" ? entityName(project, effect.value) : formatValue(project, variable, effect.value);
    if (effect.op === "add") return `add ${what} to ${name}`;
    if (effect.op === "remove") return `remove ${what} from ${name}`;
    if (effect.op === "set") return `set ${name} to ${what}`;
    if (effect.op === "clear") return `clear ${name}`;
  }
  if (effect.op === "set") return `set ${name} to ${formatValue(project, variable, effect.value)}`;
  if (effect.op === "add") {
    const amount = typeof effect.value === "number" ? effect.value : 0;
    return amount < 0 ? `subtract ${Math.abs(amount)} from ${name}` : `add ${amount} to ${name}`;
  }
  if (effect.op === "toggle") return `toggle ${name}`;
  return `clear ${name}`;
}

export function opsForVariable(kind: string | undefined): EffectOp[] {
  if (kind === "boolean") return ["set", "toggle", "clear"];
  if (kind === "value") return ["set", "add", "clear"];
  if (kind === "inventory") return ["add", "remove", "set", "clear"];
  if (kind === "character" || kind === "item" || kind === "location") return ["set", "remove", "clear"];
  return ["set", "clear"];
}
