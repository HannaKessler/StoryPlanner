import { appendCondition, emptyRule, opLabel, opsForKind, ruleForVariable } from "../domain/conditions";
import type { CompareOp, Condition, EntityKind, ProjectDocument, Scalar } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { menuHandler, type MenuItem } from "./ContextMenu";
import { EntitySelect } from "./EntitySelect";
import { IconButton, NumberField } from "./Panel";

type Rule = Extract<Condition, { type: "compare" } | { type: "has" }>;

const allGroup = (): Condition => ({ type: "group", op: "and", children: [] });
const anyGroup = (): Condition => ({ type: "group", op: "or", children: [] });

export function ConditionBuilder({
  value,
  onChange,
}: {
  value: Condition | null;
  onChange: (next: Condition | null) => void;
}) {
  const project = useProjectStore((state) => state.project);
  if (!project) return null;
  const noVariables = project.variables.length === 0;
  return (
    <div className="sp-cond">
      <div className="sp-cond-tools">
        <button type="button" className="sp-chip-btn" disabled={noVariables} onClick={() => onChange(appendCondition(value, emptyRule()))}>
          + rule
        </button>
        <button type="button" className="sp-chip-btn" onClick={() => onChange(appendCondition(value, allGroup()))}>
          + all of
        </button>
        <button type="button" className="sp-chip-btn" onClick={() => onChange(appendCondition(value, anyGroup()))}>
          + any of
        </button>
      </div>
      {value && <ConditionNode value={value} onChange={onChange} root />}
    </div>
  );
}

function groupAddItems(value: Extract<Condition, { type: "group" }>, onChange: (next: Condition) => void, noVariables: boolean): MenuItem[] {
  const add = (child: Condition) => onChange({ ...value, children: [...value.children, child] });
  return [
    { label: "Add rule", disabled: noVariables, onSelect: () => add(emptyRule()) },
    { label: "Add all of", onSelect: () => add(allGroup()) },
    { label: "Add any of", onSelect: () => add(anyGroup()) },
  ];
}

function ConditionNode({
  value,
  onChange,
  root = false,
}: {
  value: Condition;
  onChange: (next: Condition | null) => void;
  root?: boolean;
}) {
  const project = useProjectStore((state) => state.project);
  if (!project) return null;
  const noVariables = project.variables.length === 0;

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
          <button type="button" className="sp-chip-btn" onClick={() => onChange(value.child)}>
            unwrap
          </button>
          <IconButton label="Delete" danger onClick={() => onChange(null)}>
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
        onContextMenu={menuHandler(() => [
          ...groupAddItems(value, onChange, noVariables),
          { label: "Not", onSelect: () => onChange({ type: "not", child: value }) },
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
          {!root && (
            <>
              <button
                type="button"
                className="sp-chip-btn"
                disabled={noVariables}
                onClick={() => onChange({ ...value, children: [...value.children, emptyRule()] })}
              >
                + rule
              </button>
              <button
                type="button"
                className="sp-chip-btn"
                onClick={() => onChange({ ...value, children: [...value.children, value.op === "and" ? anyGroup() : allGroup()] })}
              >
                + {value.op === "and" ? "any of" : "all of"}
              </button>
            </>
          )}
          <button type="button" className="sp-chip-btn" onClick={() => onChange({ type: "not", child: value })}>
            not
          </button>
          <IconButton label="Delete group" danger onClick={() => onChange(null)}>
            ×
          </IconButton>
        </div>
        {value.children.map((child, index) => (
          <ConditionNode key={index} value={child} onChange={(next) => replaceChild(index, next)} />
        ))}
      </div>
    );
  }

  return <RuleRow value={value} onChange={onChange} project={project} />;
}

function RuleRow({ value, onChange, project }: { value: Rule; onChange: (next: Condition | null) => void; project: ProjectDocument }) {
  const variable = project.variables.find((item) => item.id === value.variableId);
  const pickVariable = (id: string) => onChange(ruleForVariable(project.variables.find((item) => item.id === id), value));
  return (
    <div
      className="sp-cond-rule"
      onContextMenu={menuHandler(() => [
        { label: "Not", onSelect: () => onChange({ type: "not", child: value }) },
        "separator",
        { label: "Delete rule", danger: true, onSelect: () => onChange(null) },
      ])}
    >
      <select
        className="sp-cell"
        aria-label="Variable"
        value={value.variableId}
        onChange={(event) => pickVariable(event.target.value)}
      >
        <option value="">variable…</option>
        {project.variables.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      {!value.variableId ? (
        <>
          <span />
          <span />
        </>
      ) : value.type === "has" ? (
        <>
          <span className="sp-cond-op">has</span>
          <EntitySelect kind="item" value={value.entityId || null} onChange={(entityId) => onChange({ ...value, entityId: entityId ?? "" })} allowEmpty />
        </>
      ) : (
        <>
          <select className="sp-cell" aria-label="Comparison" value={value.op} onChange={(event) => onChange({ ...value, op: event.target.value as CompareOp })}>
            {opsForKind(variable?.kind).map((op) => (
              <option key={op} value={op}>
                {opLabel(op)}
              </option>
            ))}
          </select>
          <ValueInput kind={variable?.kind} value={value.value} onChange={(next) => onChange({ ...value, value: next })} />
        </>
      )}
      <IconButton label="Not" onClick={() => onChange({ type: "not", child: value })}>
        ¬
      </IconButton>
      <IconButton label="Delete rule" danger onClick={() => onChange(null)}>
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
      <NumberField label="Value" value={typeof value === "number" ? value : 0} onCommit={onChange} />
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
