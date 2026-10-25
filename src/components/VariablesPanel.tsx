import { useState } from "react";
import { kindLabel } from "../domain/labels";
import type { ProjectDocument, VariableDef } from "../domain/types";
import { KNOWN_VARIABLE_KINDS } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { focusRename, menuHandler, type MenuItem } from "./ContextMenu";
import { IconButton, Section } from "./Panel";

const KIND_SHORT: Record<string, string> = { boolean: "bool", value: "value", tag: "tag" };

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
  const known = variable.kind === "boolean" || variable.kind === "value" || variable.kind === "tag";
  const category = project.tagCategories.find((item) => item.id === variable.tagCategoryId);

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
          title={known ? `${kindLabel(variable.kind)}: description${variable.kind === "tag" ? ", category" : ""}` : `${variable.kind}: from a newer editor, kept as-is`}
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
        {variable.kind === "tag" && (
          <select
            className="sp-cell sp-cell-value"
            aria-label="Default tag"
            value={typeof variable.defaultValue === "string" ? variable.defaultValue : ""}
            onChange={(event) => updateVariable(variable.id, { defaultValue: event.target.value || null })}
          >
            <option value="">unset</option>
            {category?.tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
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
          {variable.kind === "tag" && (
            <select
              className="sp-cell"
              aria-label="Tag category"
              value={variable.tagCategoryId ?? ""}
              onChange={(event) => updateVariable(variable.id, { tagCategoryId: event.target.value || null, defaultValue: null })}
            >
              <option value="">No category</option>
              {project.tagCategories.map((item) => (
                <option key={item.id} value={item.id}>
                  from {item.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </li>
  );
}
