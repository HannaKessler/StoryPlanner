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
    return <span className="sp-hint">No tag category on this variable.</span>;
  }

  if (adding) {
    return (
      <form
        className="sp-tag-select"
        onSubmit={(event) => {
          event.preventDefault();
          const id = addTag(category.id, name);
          if (id) onChange(id);
          setName("");
          setAdding(false);
        }}
      >
        <input
          className="sp-cell"
          value={name}
          placeholder={`New ${category.name} tag`}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => !name.trim() && setAdding(false)}
          autoFocus
        />
      </form>
    );
  }

  return (
    <div className="sp-tag-select">
      <select
        className="sp-cell"
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
        <option value="__new__">+ new {category.name} tag</option>
      </select>
    </div>
  );
}
