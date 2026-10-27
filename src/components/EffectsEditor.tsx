import { describeEffect, opsForVariable } from "../domain/effects";
import type { Effect, EffectOp, Scalar } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { menuHandler } from "./ContextMenu";
import { IconButton, NumberField } from "./Panel";
import { EntitySelect } from "./EntitySelect";
import type { EntityKind } from "../domain/types";

const OP_LABEL: Record<EffectOp, string> = { set: "set", add: "add", remove: "remove", toggle: "toggle", clear: "clear" };

/** Subtract is shown as its own choice and stored as `add` with a negative amount. */
type ShownOp = EffectOp | "subtract";

function shownOp(effect: Effect): ShownOp {
  return effect.op === "add" && typeof effect.value === "number" && effect.value < 0 ? "subtract" : effect.op;
}

export function EffectsEditor({
  effects,
  onAdd,
  onUpdate,
  onDelete,
  onMove,
}: {
  effects: Effect[];
  onAdd: () => void;
  onUpdate: (effectId: string, patch: Partial<Effect>) => void;
  onDelete: (effectId: string) => void;
  onMove: (effectId: string, direction: -1 | 1) => void;
}) {
  const project = useProjectStore((state) => state.project);
  if (!project) return null;
  if (effects.length === 0) return null;
  return (
    <div className="sp-effects">
      {effects.map((effect, index) => {
        const variable = project.variables.find((item) => item.id === effect.variableId);
        const ops: ShownOp[] = opsForVariable(variable?.kind);
        if (variable?.kind === "value") ops.splice(ops.indexOf("add") + 1, 0, "subtract");
        const op = shownOp(effect);
        return (
          <div
            key={effect.id}
            className="sp-effect-row"
            title={describeEffect(effect, project)}
            onContextMenu={menuHandler(() => [
              { label: "Add effect", onSelect: onAdd },
              "separator",
              { label: "Delete effect", danger: true, onSelect: () => onDelete(effect.id) },
            ])}
          >
            <select
              className="sp-cell"
              aria-label="Operation"
              value={op}
              onChange={(event) => {
                const next = event.target.value as ShownOp;
                const amount = typeof effect.value === "number" ? Math.abs(effect.value) : 1;
                if (next === "subtract") onUpdate(effect.id, { op: "add", value: -(amount || 1) });
                else if (next === "add") onUpdate(effect.id, { op: "add", value: amount || 1 });
                else onUpdate(effect.id, { op: next });
              }}
            >
              {ops.map((item) => (
                <option key={item} value={item}>
                  {item === "subtract" ? "subtract" : OP_LABEL[item]}
                </option>
              ))}
            </select>
            <select
              className="sp-cell"
              aria-label="Variable"
              value={effect.variableId}
              onChange={(event) => {
                const next = project.variables.find((item) => item.id === event.target.value);
                const nextOps = opsForVariable(next?.kind);
                onUpdate(effect.id, {
                  variableId: event.target.value,
                  op: nextOps.includes(effect.op) ? effect.op : nextOps[0],
                  value: next?.kind === "boolean" ? true : next?.kind === "value" ? 0 : null,
                });
              }}
            >
              <option value="">variable…</option>
              {project.variables.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {effect.op !== "toggle" && effect.op !== "clear" ? (
              <EffectValue
                kind={variable?.kind}
                op={effect.op}
                value={op === "subtract" && typeof effect.value === "number" ? -effect.value : effect.value}
                onChange={(value) => onUpdate(effect.id, { value: op === "subtract" && typeof value === "number" ? -Math.abs(value) : value })}
              />
            ) : (
              <span />
            )}
            <span className="sp-line-tools">
              <IconButton label="Move effect up" disabled={index === 0} onClick={() => onMove(effect.id, -1)}>
                ↑
              </IconButton>
              <IconButton label="Move effect down" disabled={index === effects.length - 1} onClick={() => onMove(effect.id, 1)}>
                ↓
              </IconButton>
              <IconButton label="Delete effect" danger onClick={() => onDelete(effect.id)}>
                ×
              </IconButton>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function EffectValue({
  kind,
  op,
  value,
  onChange,
}: {
  kind: string | undefined;
  op: EffectOp;
  value: Scalar;
  onChange: (value: Scalar) => void;
}) {
  if (kind === "boolean") {
    return (
      <select className="sp-cell" aria-label="Value" value={value === true ? "true" : "false"} onChange={(event) => onChange(event.target.value === "true")}>
        <option value="true">to true</option>
        <option value="false">to false</option>
      </select>
    );
  }
  if (kind === "value" || (op === "add" && kind !== "inventory" && kind !== "character" && kind !== "item" && kind !== "location")) {
    return (
      <NumberField label="Amount" value={typeof value === "number" ? value : 0} onCommit={onChange} />
    );
  }
  const entityKind: EntityKind | null =
    kind === "character" || kind === "location" ? kind : kind === "item" || kind === "inventory" ? "item" : null;
  if (entityKind) {
    return <EntitySelect kind={entityKind} value={typeof value === "string" ? value : null} onChange={onChange} allowEmpty />;
  }
  return <input className="sp-cell" aria-label="Value" value={value == null ? "" : String(value)} onChange={(event) => onChange(event.target.value)} />;
}
