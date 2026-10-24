import { describeCondition, defaultCompare, opLabel, opsForKind } from "../domain/conditions";
import type { CompareOp, Condition, Scalar } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { TagSelect } from "./TagSelect";

export function ConditionBuilder({
  value,
  onChange,
}: {
  value: Condition | null;
  onChange: (next: Condition | null) => void;
}) {
  const project = useProjectStore((state) => state.project);
  if (!project) return null;
  return (
    <div className="sp-cond">
      <p className="sp-cond-summary">{describeCondition(value, project)}</p>
      {value ? (
        <ConditionNode value={value} onChange={onChange} />
      ) : (
        <div className="sp-inline">
          <button type="button" className="sp-btn sp-btn-small" onClick={() => onChange(defaultCompare(project.variables[0]?.id ?? ""))}>
            Add rule
          </button>
          <button type="button" className="sp-btn sp-btn-small" onClick={() => onChange({ type: "group", op: "and", children: [] })}>
            All of
          </button>
          <button type="button" className="sp-btn sp-btn-small" onClick={() => onChange({ type: "group", op: "or", children: [] })}>
            Any of
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

  if (value.type === "not") {
    return (
      <div className="sp-cond-card">
        <div className="sp-cond-head">
          <strong>Not</strong>
          <button type="button" className="sp-btn sp-btn-small" onClick={() => onChange(value.child)}>
            Unwrap
          </button>
          <button type="button" className="sp-btn sp-btn-small" onClick={() => onChange(null)}>
            Remove
          </button>
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
      <div className="sp-cond-card">
        <div className="sp-cond-head">
          <select
            className="sp-select"
            value={value.op}
            onChange={(event) => onChange({ ...value, op: event.target.value as "and" | "or" })}
          >
            <option value="and">All of</option>
            <option value="or">Any of</option>
          </select>
          <button type="button" className="sp-btn sp-btn-small" onClick={() => onChange({ type: "not", child: value })}>
            Wrap in Not
          </button>
          <button type="button" className="sp-btn sp-btn-small" onClick={() => onChange(null)}>
            Remove
          </button>
        </div>
        <div className="sp-cond-children">
          {value.children.map((child, index) => (
            <ConditionNode key={index} value={child} onChange={(next) => replaceChild(index, next)} />
          ))}
        </div>
        <div className="sp-inline">
          <button
            type="button"
            className="sp-btn sp-btn-small"
            onClick={() => onChange({ ...value, children: [...value.children, defaultCompare(project.variables[0]?.id ?? "")] })}
          >
            + Rule
          </button>
          <button
            type="button"
            className="sp-btn sp-btn-small"
            onClick={() =>
              onChange({
                ...value,
                children: [...value.children, { type: "group", op: value.op === "and" ? "or" : "and", children: [] }],
              })
            }
          >
            + Group
          </button>
        </div>
      </div>
    );
  }

  const variable = project.variables.find((item) => item.id === value.variableId);
  const ops = opsForKind(variable?.kind);
  return (
    <div className="sp-cond-rule">
      <select
        className="sp-select"
        value={value.variableId}
        onChange={(event) => {
          const nextVariable = project.variables.find((item) => item.id === event.target.value);
          const allowed = opsForKind(nextVariable?.kind);
          onChange({
            ...value,
            variableId: event.target.value,
            op: allowed.includes(value.op) ? value.op : allowed[0],
            value: defaultFor(nextVariable?.kind),
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
        value={value.op}
        onChange={(event) => onChange({ ...value, op: event.target.value as CompareOp })}
      >
        {ops.map((op) => (
          <option key={op} value={op}>
            {opLabel(op)}
          </option>
        ))}
      </select>
      <ValueInput
        kind={variable?.kind}
        categoryId={variable?.tagCategoryId ?? null}
        value={value.value}
        onChange={(next) => onChange({ ...value, value: next })}
      />
      <button type="button" className="sp-icon-btn" onClick={() => onChange(null)} aria-label="Remove rule">
        ×
      </button>
    </div>
  );
}

function ValueInput({
  kind,
  categoryId,
  value,
  onChange,
}: {
  kind: string | undefined;
  categoryId: string | null;
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
  if (kind === "value") {
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
  return (
    <input
      className="sp-input"
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function defaultFor(kind: string | undefined): Scalar {
  if (kind === "boolean") return true;
  if (kind === "value") return 0;
  return null;
}
