import { describeEffect, opsForVariable } from "../domain/effects";
import type { Effect, EffectOp, Scalar } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { TagSelect } from "./TagSelect";

export function EffectsEditor({
  effects,
  onAdd,
  onUpdate,
  onDelete,
}: {
  effects: Effect[];
  onAdd: () => void;
  onUpdate: (effectId: string, patch: Partial<Effect>) => void;
  onDelete: (effectId: string) => void;
}) {
  const project = useProjectStore((state) => state.project);
  if (!project) return null;
  return (
    <div className="sp-effects">
      {effects.length === 0 && <p className="sp-muted">No variable changes.</p>}
      {effects.map((effect) => {
        const variable = project.variables.find((item) => item.id === effect.variableId);
        const ops = opsForVariable(variable?.kind);
        return (
          <div key={effect.id} className="sp-effect-row">
            <select
              className="sp-select"
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
              <option value="">Variable…</option>
              {project.variables.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              className="sp-select"
              value={effect.op}
              onChange={(event) => onUpdate(effect.id, { op: event.target.value as EffectOp })}
            >
              {ops.map((op) => (
                <option key={op} value={op}>
                  {op === "set" ? "Set" : op === "add" ? "Add" : op === "toggle" ? "Toggle" : "Clear"}
                </option>
              ))}
            </select>
            {effect.op !== "toggle" && effect.op !== "clear" && (
              <EffectValue
                kind={variable?.kind}
                categoryId={variable?.tagCategoryId ?? null}
                op={effect.op}
                value={effect.value}
                onChange={(value) => onUpdate(effect.id, { value })}
              />
            )}
            <button type="button" className="sp-icon-btn" aria-label="Remove effect" onClick={() => onDelete(effect.id)}>
              ×
            </button>
            <p className="sp-effect-readout">{describeEffect(effect, project)}</p>
          </div>
        );
      })}
      <button type="button" className="sp-btn sp-btn-small" onClick={onAdd} disabled={project.variables.length === 0}>
        {project.variables.length === 0 ? "Add a variable first" : "+ Effect"}
      </button>
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
      <select className="sp-select" value={value === true ? "true" : "false"} onChange={(event) => onChange(event.target.value === "true")}>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (kind === "value" || op === "add") {
    return (
      <input
        className="sp-input"
        type="number"
        value={typeof value === "number" ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    );
  }
  if (kind === "tag") {
    return <TagSelect categoryId={categoryId} value={typeof value === "string" ? value : null} onChange={onChange} allowEmpty />;
  }
  return <input className="sp-input" value={value == null ? "" : String(value)} onChange={(event) => onChange(event.target.value)} />;
}
