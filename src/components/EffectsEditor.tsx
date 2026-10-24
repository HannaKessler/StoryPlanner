import { describeEffect, opsForVariable } from "../domain/effects";
import type { Effect, EffectOp, Scalar } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { IconButton } from "./Panel";
import { TagSelect } from "./TagSelect";

const OP_LABEL: Record<EffectOp, string> = { set: "set", add: "add", toggle: "toggle", clear: "clear" };

export function EffectsEditor({
  effects,
  onUpdate,
  onDelete,
}: {
  effects: Effect[];
  onUpdate: (effectId: string, patch: Partial<Effect>) => void;
  onDelete: (effectId: string) => void;
}) {
  const project = useProjectStore((state) => state.project);
  if (!project) return null;
  if (effects.length === 0) return null;
  return (
    <div className="sp-effects">
      {effects.map((effect) => {
        const variable = project.variables.find((item) => item.id === effect.variableId);
        const ops = opsForVariable(variable?.kind);
        return (
          <div key={effect.id} className="sp-effect-row" title={describeEffect(effect, project)}>
            <select
              className="sp-cell"
              aria-label="Operation"
              value={effect.op}
              onChange={(event) => onUpdate(effect.id, { op: event.target.value as EffectOp })}
            >
              {ops.map((op) => (
                <option key={op} value={op}>
                  {OP_LABEL[op]}
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
                categoryId={variable?.tagCategoryId ?? null}
                op={effect.op}
                value={effect.value}
                onChange={(value) => onUpdate(effect.id, { value })}
              />
            ) : (
              <span />
            )}
            <IconButton label="Remove effect" danger onClick={() => onDelete(effect.id)}>
              ×
            </IconButton>
          </div>
        );
      })}
    </div>
  );
}

function EffectValue({
  kind,
  categoryId,
  op,
  value,
  onChange,
}: {
  kind: string | undefined;
  categoryId: string | null;
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
  if (kind === "value" || op === "add") {
    return (
      <input
        className="sp-cell"
        type="number"
        aria-label="Amount"
        value={typeof value === "number" ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    );
  }
  if (kind === "tag") {
    return <TagSelect categoryId={categoryId} value={typeof value === "string" ? value : null} onChange={onChange} allowEmpty />;
  }
  return <input className="sp-cell" aria-label="Value" value={value == null ? "" : String(value)} onChange={(event) => onChange(event.target.value)} />;
}
