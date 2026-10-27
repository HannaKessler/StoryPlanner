import { useState } from "react";
import { entityLabel } from "../domain/names";
import { entitiesOf } from "../domain/format";
import type { EntityKind } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { CreateField } from "./CreateField";

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
  const [adding, setAdding] = useState(false);
  const entities = project ? entitiesOf(project, kind) : [];

  if (adding) {
    return <CreateField kind={kind} label={`New ${kind}`} onPick={(id) => onChange(id)} onClose={() => setAdding(false)} />;
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
          {project ? entityLabel(project, entity) : entity.name}
        </option>
      ))}
      <option value="__new__">+ {kind}</option>
    </select>
  );
}
