import { useState } from "react";
import { entitiesOf } from "../domain/format";
import { kindLabel } from "../domain/labels";
import type { EntityKind, ProjectDocument, VariableDef, VariableValue } from "../domain/types";
import { KNOWN_VARIABLE_KINDS } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { focusRename, menuHandler, type MenuItem } from "./ContextMenu";
import { IconButton, Section } from "./Panel";

const KIND_SHORT: Record<string, string> = {
  boolean: "bool",
  value: "value",
  character: "char",
  item: "item",
  location: "loc",
  inventory: "items",
};

function addVariableItems(): MenuItem[] {
  return KNOWN_VARIABLE_KINDS.map((kind) => ({
    label: `Add ${kindLabel(kind).toLowerCase()} variable`,
    onSelect: () => useProjectStore.getState().addVariable(kind),
  }));
}

export function VariablesPanel() {
  const project = useProjectStore((state) => state.project);
  const addVariable = useProjectStore((state) => state.addVariable);
  if (!project) return null;
  return (
    <Section
      id="left:variables"
      title="Variables"
      count={project.variables.length}
      onContextMenu={menuHandler(addVariableItems)}
      actions={KNOWN_VARIABLE_KINDS.map((kind) => (
        <button key={kind} type="button" className="sp-chip-btn" title={`Add a ${kindLabel(kind).toLowerCase()} variable`} onClick={() => addVariable(kind)}>
          + {KIND_SHORT[kind]}
        </button>
      ))}
    >
      <ul className="sp-var-list">
        {project.variables.map((variable) => (
          <VariableRow key={variable.id} variable={variable} project={project} />
        ))}
      </ul>
    </Section>
  );
}

function VariableRow({ variable, project }: { variable: VariableDef; project: ProjectDocument }) {
  const updateVariable = useProjectStore((state) => state.updateVariable);
  const deleteVariable = useProjectStore((state) => state.deleteVariable);
  const [expanded, setExpanded] = useState(false);
  const known = (["boolean", "value", "character", "item", "location", "inventory"] as string[]).includes(variable.kind);
  const entityKind: EntityKind | null =
    variable.kind === "character" || variable.kind === "item" || variable.kind === "location"
      ? variable.kind
      : variable.kind === "inventory"
        ? "item"
        : null;

  return (
    <li
      className={expanded ? "sp-var is-expanded" : "sp-var"}
      onContextMenu={menuHandler(() => [
        ...addVariableItems(),
        "separator",
        { label: "Rename", onSelect: () => focusRename(variable.id) },
        { label: "Delete", danger: true, onSelect: () => deleteVariable(variable.id) },
      ])}
    >
      <div className="sp-var-main">
        <button
          type="button"
          className={`sp-kind sp-kind-${known ? variable.kind : "other"}`}
          title={known ? kindLabel(variable.kind) : variable.kind}
          onClick={() => setExpanded((open) => !open)}
        >
          {KIND_SHORT[variable.kind] ?? variable.kind}
        </button>
        <input
          className="sp-cell"
          aria-label="Variable name"
          data-rename={variable.id}
          value={variable.name}
          onChange={(event) => updateVariable(variable.id, { name: event.target.value })}
        />
        {variable.kind === "boolean" && (
          <select
            className="sp-cell sp-cell-value"
            aria-label="Default value"
            value={variable.defaultValue === true ? "true" : "false"}
            onChange={(event) => updateVariable(variable.id, { defaultValue: event.target.value === "true" })}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        )}
        {variable.kind === "value" && (
          <input
            className="sp-cell sp-cell-value"
            type="number"
            aria-label="Default value"
            value={typeof variable.defaultValue === "number" ? variable.defaultValue : 0}
            onChange={(event) => updateVariable(variable.id, { defaultValue: Number(event.target.value) })}
          />
        )}
        {entityKind && variable.kind !== "inventory" && (
          <select
            className="sp-cell sp-cell-value"
            aria-label="Default value"
            value={typeof variable.defaultValue === "string" ? variable.defaultValue : ""}
            onChange={(event) => updateVariable(variable.id, { defaultValue: event.target.value || null })}
          >
            <option value="">unset</option>
            {entitiesOf(project, entityKind).map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name || "Untitled"}
              </option>
            ))}
          </select>
        )}
        {variable.kind === "inventory" && (
          <select
            className="sp-cell sp-cell-value"
            aria-label="Default items"
            value=""
            onChange={(event) => {
              const current = Array.isArray(variable.defaultValue) ? variable.defaultValue : [];
              if (event.target.value && !current.includes(event.target.value)) {
                updateVariable(variable.id, { defaultValue: [...current, event.target.value] });
              }
            }}
          >
            <option value="">{Array.isArray(variable.defaultValue) && variable.defaultValue.length ? `${variable.defaultValue.length}` : "empty"}</option>
            {project.items
              .filter((item) => !(Array.isArray(variable.defaultValue) && variable.defaultValue.includes(item.id)))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name || "Untitled"}
                </option>
              ))}
          </select>
        )}
        {!known && <span className="sp-cell sp-cell-value sp-faint">{String(variable.defaultValue ?? "unset")}</span>}
        <IconButton label={`Delete ${variable.name}`} danger onClick={() => deleteVariable(variable.id)}>
          ×
        </IconButton>
      </div>
      {expanded && (
        <div className="sp-var-more">
          <input
            className="sp-cell"
            placeholder="Description"
            value={variable.description}
            onChange={(event) => updateVariable(variable.id, { description: event.target.value })}
          />
          {variable.kind === "inventory" && Array.isArray(variable.defaultValue) && variable.defaultValue.length > 0 && (
            <div className="sp-loc-picks">
              {variable.defaultValue.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="sp-chip-btn is-on"
                  onClick={() =>
                    updateVariable(variable.id, {
                      defaultValue: (variable.defaultValue as VariableValue[]).filter((item) => item !== id) as VariableValue,
                    })
                  }
                >
                  {project.items.find((item) => item.id === id)?.name || "Untitled"} ×
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
