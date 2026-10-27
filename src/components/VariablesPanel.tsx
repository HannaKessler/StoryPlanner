import { useState } from "react";
import { kindLabel } from "../domain/labels";
import type { ProjectDocument, VariableDef } from "../domain/types";
import { KNOWN_VARIABLE_KINDS } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { focusRename, menuHandler, openMenuBelow, type MenuItem } from "./ContextMenu";
import { isDuplicateName, uniqueName } from "../domain/names";
import { IconButton, Section } from "./Panel";

const KIND_SHORT: Record<string, string> = {
  boolean: "bool",
  value: "value",
  character: "char",
  item: "item",
  location: "loc",
  inventory: "inv",
};

/** One entry per kind. Choosing one adds the variable and focuses its name. */
function kindItems(prefix = ""): MenuItem[] {
  return KNOWN_VARIABLE_KINDS.map((kind) => ({
    label: `${prefix}${kindLabel(kind)}`,
    onSelect: () => {
      const id = useProjectStore.getState().addVariable(kind);
      if (id) focusRename(id);
    },
  }));
}

const addVariableItems = () => kindItems("Add ");

export function VariablesPanel() {
  const project = useProjectStore((state) => state.project);
  if (!project) return null;
  return (
    <Section
      id="left:variables"
      title="Variables"
      count={project.variables.length}
      onContextMenu={menuHandler(addVariableItems)}
      actions={
        <button
          type="button"
          className="sp-chip-btn sp-add"
          aria-label="Add variable"
          title="Add variable"
          onClick={(event) => openMenuBelow(event.currentTarget, kindItems())}
        >
          +
        </button>
      }
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
  const requestDeleteVariable = useProjectStore((state) => state.requestDeleteVariable);
  const [expanded, setExpanded] = useState(false);
  const otherNames = project.variables.filter((item) => item.id !== variable.id).map((item) => item.name);
  const duplicate = isDuplicateName(variable.name, otherNames);
  const known = (["boolean", "value", "character", "item", "location", "inventory"] as string[]).includes(variable.kind);

  return (
    <li
      className={expanded ? "sp-var is-expanded" : "sp-var"}
      onContextMenu={menuHandler(() => [
        ...addVariableItems(),
        "separator",
        { label: "Rename", onSelect: () => focusRename(variable.id) },
        { label: "Delete", danger: true, onSelect: () => requestDeleteVariable(variable.id) },
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
          className={duplicate ? "sp-cell is-dup" : "sp-cell"}
          aria-label="Variable name"
          aria-invalid={duplicate || undefined}
          title={duplicate ? "Name in use" : undefined}
          data-rename={variable.id}
          value={variable.name}
          onChange={(event) => updateVariable(variable.id, { name: event.target.value })}
          onBlur={() => {
            const fixed = uniqueName(variable.name || KIND_SHORT[variable.kind] || "variable", otherNames);
            if (fixed !== variable.name) updateVariable(variable.id, { name: fixed });
          }}
        />
        <IconButton label={`Delete ${variable.name}`} danger onClick={() => requestDeleteVariable(variable.id)}>
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
        </div>
      )}
    </li>
  );
}
