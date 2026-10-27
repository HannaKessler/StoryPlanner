import { useState } from "react";
import { entitiesOf } from "../domain/format";
import { entityLabel } from "../domain/names";
import type { EntityKind } from "../domain/types";
import { useProjectStore } from "../store/projectStore";

/** A name field that picks a matching entity or creates a new one. Closes on pick, Escape or blur. */
export function CreateField({
  kind,
  label,
  exclude = [],
  onPick,
  onClose,
}: {
  kind: EntityKind;
  label: string;
  exclude?: string[];
  onPick: (id: string, created: boolean) => void;
  onClose: () => void;
}) {
  const project = useProjectStore((state) => state.project);
  const [name, setName] = useState("");
  const [active, setActive] = useState(0);
  if (!project) return null;
  const wanted = name.trim();
  const lower = wanted.toLowerCase();
  const entities = entitiesOf(project, kind).filter((entity) => !exclude.includes(entity.id));
  const matches = wanted ? entities.filter((entity) => entity.name.toLowerCase().includes(lower)).slice(0, 5) : [];
  const exact = entities.some((entity) => entity.name.trim().toLowerCase() === lower);
  const options: Array<{ id: string | null; text: string }> = [
    ...matches.map((entity) => ({ id: entity.id, text: entityLabel(project, entity) })),
    ...(wanted && !exact ? [{ id: null, text: `Create "${wanted}"` }] : []),
  ];
  const choose = (option: { id: string | null } | undefined) => {
    if (!option) return;
    if (option.id) onPick(option.id, false);
    else {
      const id = useProjectStore.getState().createEntityAnd(kind, wanted, (created) => onPick(created, true));
      if (!id) return;
    }
    onClose();
  };
  const current = Math.min(active, Math.max(options.length - 1, 0));
  return (
    <span className="sp-create">
      <input
        className="sp-cell"
        aria-label={label}
        role="combobox"
        aria-expanded={options.length > 0}
        autoFocus
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setActive(0);
        }}
        onBlur={onClose}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") setActive(Math.min(current + 1, options.length - 1));
          else if (event.key === "ArrowUp") setActive(Math.max(current - 1, 0));
          else if (event.key === "Enter") choose(options[current]);
          else if (event.key === "Escape") onClose();
          else return;
          event.preventDefault();
          event.stopPropagation();
        }}
      />
      {options.length > 0 && (
        <span className="sp-create-list" role="listbox">
          {options.map((option, index) => (
            <button
              key={option.id ?? "new"}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={index === current}
              className={index === current ? "is-active" : ""}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              {option.text}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
