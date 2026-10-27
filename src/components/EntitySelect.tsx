import { useState } from "react";
import { entitiesOf } from "../domain/format";
import type { EntityKind } from "../domain/types";
import { useProjectStore } from "../store/projectStore";

export function EntitySelect({
  kind,
  value,
  onChange,
  allowEmpty = false,
}: {
  kind: EntityKind;
  value: string | null;
  onChange: (id: string | null) => void;
  allowEmpty?: boolean;
}) {
  const project = useProjectStore((state) => state.project);
  const addEntity = useProjectStore((state) => state.addEntity);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const entities = project ? entitiesOf(project, kind) : [];

  if (adding) {
    return (
      <form
        className="sp-tag-select"
        onSubmit={(event) => {
          event.preventDefault();
          const id = addEntity(kind, name);
          if (id) onChange(id);
          setName("");
          setAdding(false);
        }}
      >
        <input
          className="sp-cell"
          value={name}
          aria-label={`New ${kind}`}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => !name.trim() && setAdding(false)}
          autoFocus
        />
      </form>
    );
  }

  return (
    <select
      className="sp-cell"
      aria-label={kind}
      value={value ?? ""}
      onChange={(event) => {
        if (event.target.value === "__new__") {
          setAdding(true);
          return;
        }
        onChange(event.target.value || null);
      }}
    >
      {allowEmpty && <option value="">unset</option>}
      {entities.map((entity) => (
        <option key={entity.id} value={entity.id}>
          {entity.name || "Untitled"}
        </option>
      ))}
      <option value="__new__">+ {kind}</option>
    </select>
  );
}
