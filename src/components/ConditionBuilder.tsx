import { defaultCompare, opLabel, opsForKind } from "../domain/conditions";
import type { CompareOp, Condition, Scalar } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { menuHandler } from "./ContextMenu";
import { IconButton } from "./Panel";
import { EntitySelect } from "./EntitySelect";
import type { EntityKind } from "../domain/types";

export function ConditionBuilder({
  value,
  onChange,
}: {
  value: Condition | null;
  onChange: (next: Condition | null) => void;
}) {
  const project = useProjectStore((state) => state.project);
  if (!project) return null;
  const firstVariable = project.variables[0]?.id ?? "";
  return (
    <div className="sp-cond">
      {value ? (
        <ConditionNode value={value} onChange={onChange} />
      ) : (
        <div className="sp-cond-tools">
          <button type="button" className="sp-chip-btn" disabled={!firstVariable} onClick={() => onChange(defaultCompare(firstVariable))}>
            + rule
          </button>
          <button type="button" className="sp-chip-btn" onClick={() => onChange({ type: "group", op: "and", children: [] })}>
            + all of
          </button>
          <button type="button" className="sp-chip-btn" onClick={() => onChange({ type: "group", op: "or", children: [] })}>
            + any of
          </button>
        </div>
      )}
    </div>
  );
}

function ConditionNode({
  value,
  onChange,
}: {
  value: Condition;
  onChange: (next: Condition | null) => void;
}) {
  const project = useProjectStore((state) => state.project);
  if (!project) return null;
  const firstVariable = project.variables[0]?.id ?? "";

  if (value.type === "not") {
    return (
      <div
        className="sp-cond-group is-not"
        onContextMenu={menuHandler(() => [
          { label: "Unwrap", onSelect: () => onChange(value.child) },
          "separator",
          { label: "Delete", danger: true, onSelect: () => onChange(null) },
        ])}
      >
        <div className="sp-cond-head">
          <span className="sp-cond-op">NOT</span>
          <span className="sp-grow" />
          <button type="button" className="sp-chip-btn" onClick={() => onChange(value.child)} title="Remove the NOT and keep what is inside">
            unwrap
          </button>
          <IconButton label="Remove" danger onClick={() => onChange(null)}>
            ×
          </IconButton>
        </div>
        <ConditionNode value={value.child} onChange={(child) => onChange(child ? { type: "not", child } : null)} />
      </div>
    );
  }

  if (value.type === "group") {
    const replaceChild = (index: number, next: Condition | null) => {
      const children = value.children.slice();
      if (next) children[index] = next;
      else children.splice(index, 1);
      onChange({ ...value, children });
    };
    return (
      <div
        className={`sp-cond-group is-${value.op}`}
        title={value.children.length === 0 ? (value.op === "and" ? "Empty: always passes" : "Empty: never passes") : undefined}
        onContextMenu={menuHandler(() => [
          {
            label: "Add rule",
            disabled: !firstVariable,
            onSelect: () => onChange({ ...value, children: [...value.children, defaultCompare(firstVariable)] }),
          },
          {
            label: "Add group",
            onSelect: () =>
              onChange({
                ...value,
                children: [...value.children, { type: "group", op: value.op === "and" ? "or" : "and", children: [] }],
              }),
          },
          { label: "Wrap in NOT", onSelect: () => onChange({ type: "not", child: value }) },
          "separator",
          { label: "Delete group", danger: true, onSelect: () => onChange(null) },
        ])}
      >
        <div className="sp-cond-head">
          <select
            className="sp-cell sp-cond-op-select"
            aria-label="Group type"
            value={value.op}
            onChange={(event) => onChange({ ...value, op: event.target.value as "and" | "or" })}
          >
            <option value="and">ALL of</option>
            <option value="or">ANY of</option>
          </select>
          <span className="sp-grow" />
          <button
            type="button"
            className="sp-chip-btn"
            disabled={!firstVariable}
            onClick={() => onChange({ ...value, children: [...value.children, defaultCompare(firstVariable)] })}
          >
            + rule
          </button>
          <button
            type="button"
            className="sp-chip-btn"
            onClick={() =>
              onChange({
                ...value,
                children: [...value.children, { type: "group", op: value.op === "and" ? "or" : "and", children: [] }],
              })
            }
          >
            + group
          </button>
          <button type="button" className="sp-chip-btn" title="Wrap in NOT" onClick={() => onChange({ type: "not", child: value })}>
            not
          </button>
          <IconButton label="Remove group" danger onClick={() => onChange(null)}>
            ×
          </IconButton>
        </div>
        {value.children.map((child, index) => (
          <ConditionNode key={index} value={child} onChange={(next) => replaceChild(index, next)} />
        ))}
      </div>
    );
  }

  if (value.type === "has") {
    return (
      <div
        className="sp-cond-rule"
        onContextMenu={menuHandler(() => [
          { label: "Wrap in NOT", onSelect: () => onChange({ type: "not", child: value }) },
          "separator",
          { label: "Delete rule", danger: true, onSelect: () => onChange(null) },
        ])}
      >
        <select
          className="sp-cell"
          aria-label="Variable"
          value={value.variableId}
          onChange={(event) => onChange({ ...value, variableId: event.target.value })}
        >
          <option value="">variable…</option>
          {project.variables.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <span className="sp-cond-op">has</span>
        <EntitySelect kind="item" value={value.entityId || null} onChange={(entityId) => onChange({ ...value, entityId: entityId ?? "" })} allowEmpty />
        <IconButton label="Remove rule" danger onClick={() => onChange(null)}>
          ×
        </IconButton>
      </div>
    );
  }

  const variable = project.variables.find((item) => item.id === value.variableId);
  const ops = opsForKind(variable?.kind);
  return (
    <div
      className="sp-cond-rule"
      onContextMenu={menuHandler(() => [
        { label: "Wrap in NOT", onSelect: () => onChange({ type: "not", child: value }) },
        "separator",
        { label: "Delete rule", danger: true, onSelect: () => onChange(null) },
      ])}
    >
      <select
        className="sp-cell"
        aria-label="Variable"
        value={value.variableId}
        onChange={(event) => {
          const nextVariable = project.variables.find((item) => item.id === event.target.value);
          if (nextVariable?.kind === "inventory") {
            onChange({ type: "has", variableId: nextVariable.id, entityId: "" });
            return;
          }
          const allowed = opsForKind(nextVariable?.kind);
          onChange({
            ...value,
            variableId: event.target.value,
            op: allowed.includes(value.op) ? value.op : allowed[0],
            value: defaultFor(nextVariable?.kind),
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
      <select className="sp-cell" aria-label="Comparison" value={value.op} onChange={(event) => onChange({ ...value, op: event.target.value as CompareOp })}>
        {ops.map((op) => (
          <option key={op} value={op}>
            {opLabel(op)}
          </option>
        ))}
      </select>
      <ValueInput
        kind={variable?.kind}
        value={value.value}
        onChange={(next) => onChange({ ...value, value: next })}
      />
      <IconButton label="Wrap in NOT" onClick={() => onChange({ type: "not", child: value })}>
        ¬
      </IconButton>
      <IconButton label="Remove rule" danger onClick={() => onChange(null)}>
        ×
      </IconButton>
    </div>
  );
}

function ValueInput({
  kind,
  value,
  onChange,
}: {
  kind: string | undefined;
  value: Scalar;
  onChange: (value: Scalar) => void;
}) {
  if (kind === "boolean") {
    return (
      <select className="sp-cell" aria-label="Value" value={value === true ? "true" : "false"} onChange={(event) => onChange(event.target.value === "true")}>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (kind === "value") {
    return (
      <input
        className="sp-cell"
        type="number"
        aria-label="Value"
        value={typeof value === "number" ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    );
  }
  const entityKind: EntityKind | null = kind === "character" || kind === "item" || kind === "location" ? kind : null;
  if (entityKind) {
    return <EntitySelect kind={entityKind} value={typeof value === "string" ? value : null} onChange={onChange} allowEmpty />;
  }
  return (
    <input className="sp-cell" aria-label="Value" value={value === null || value === undefined ? "" : String(value)} onChange={(event) => onChange(event.target.value)} />
  );
}

function defaultFor(kind: string | undefined): Scalar {
  if (kind === "boolean") return true;
  if (kind === "value") return 0;
  return null;
}
