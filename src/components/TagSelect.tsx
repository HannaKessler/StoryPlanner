import { useState } from "react";
import { useProjectStore } from "../store/projectStore";

export function TagSelect({
  categoryId,
  value,
  onChange,
  allowEmpty = false,
}: {
  categoryId: string | null;
  value: string | null;
  onChange: (tagId: string | null) => void;
  allowEmpty?: boolean;
}) {
  const project = useProjectStore((state) => state.project);
  const addTag = useProjectStore((state) => state.addTag);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const category = project?.tagCategories.find((item) => item.id === categoryId);

  if (!category) {
    return <span className="sp-muted">Pick a tag category on the variable.</span>;
  }

  return (
    <div className="sp-tag-select">
      <select
        className="sp-select"
        value={value ?? ""}
        onChange={(event) => {
          if (event.target.value === "__new__") {
            setAdding(true);
            return;
          }
          onChange(event.target.value || null);
        }}
      >
        {allowEmpty && <option value="">Unset</option>}
        {category.tags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.name}
          </option>
        ))}
        <option value="__new__">+ New tag in {category.name}</option>
      </select>
      {adding && (
        <form
          className="sp-inline"
          onSubmit={(event) => {
            event.preventDefault();
            const id = addTag(category.id, name);
            if (id) onChange(id);
            setName("");
            setAdding(false);
          }}
        >
          <input
            className="sp-input"
            value={name}
            placeholder={`New ${category.name} tag`}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
          <button type="submit" className="sp-btn sp-btn-small">
            Add
          </button>
        </form>
      )}
    </div>
  );
}
