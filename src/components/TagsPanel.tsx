import { useState } from "react";
import type { TagCategory } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { IconButton, Section } from "./Panel";

export function TagsPanel() {
  const project = useProjectStore((state) => state.project);
  const addCategory = useProjectStore((state) => state.addCategory);
  if (!project) return null;
  return (
    <Section
      id="left:tags"
      title="Tags"
      count={project.tagCategories.length}
      actions={
        <button type="button" className="sp-chip-btn" onClick={addCategory}>
          + category
        </button>
      }
    >
      {project.tagCategories.map((category) => (
        <CategoryBlock key={category.id} category={category} />
      ))}
    </Section>
  );
}

function CategoryBlock({ category }: { category: TagCategory }) {
  const updateCategory = useProjectStore((state) => state.updateCategory);
  const deleteCategory = useProjectStore((state) => state.deleteCategory);
  const addTag = useProjectStore((state) => state.addTag);
  const updateTag = useProjectStore((state) => state.updateTag);
  const deleteTag = useProjectStore((state) => state.deleteTag);
  const [open, setOpen] = useState(true);
  const [name, setName] = useState("");

  return (
    <div className="sp-cat">
      <div className="sp-cat-head">
        <button type="button" className="sp-chev-btn" aria-expanded={open} aria-label="Toggle category" onClick={() => setOpen(!open)}>
          {open ? "▾" : "▸"}
        </button>
        <input
          className="sp-cell sp-cat-name"
          aria-label="Category name"
          value={category.name}
          onChange={(event) => updateCategory(category.id, { name: event.target.value })}
        />
        <button
          type="button"
          className={category.isCharacters ? "sp-flag is-on" : "sp-flag"}
          title="Tags here can be dialogue speakers"
          aria-pressed={category.isCharacters}
          onClick={() => updateCategory(category.id, { isCharacters: !category.isCharacters })}
        >
          speakers
        </button>
        <span className="sp-sec-count">{category.tags.length}</span>
        <IconButton label={`Delete category ${category.name}`} danger onClick={() => deleteCategory(category.id)}>
          ×
        </IconButton>
      </div>
      {open && (
        <div className="sp-cat-body">
          <div className="sp-chips">
            {category.tags.map((tag) => (
              <span key={tag.id} className="sp-tag-chip">
                <input
                  className="sp-chip-input"
                  aria-label="Tag name"
                  style={{ width: `${Math.max(3, tag.name.length) * 0.92}ch` }}
                  value={tag.name}
                  onChange={(event) => updateTag(category.id, tag.id, { name: event.target.value })}
                />
                <IconButton label={`Delete ${tag.name}`} danger onClick={() => deleteTag(category.id, tag.id)}>
                  ×
                </IconButton>
              </span>
            ))}
            <form
              className="sp-chip-add"
              onSubmit={(event) => {
                event.preventDefault();
                addTag(category.id, name);
                setName("");
              }}
            >
              <input className="sp-chip-input" placeholder="+ tag" size={6} value={name} onChange={(event) => setName(event.target.value)} />
            </form>
          </div>
          <input
            className="sp-cell sp-cat-desc"
            placeholder="Description"
            value={category.description}
            onChange={(event) => updateCategory(category.id, { description: event.target.value })}
          />
        </div>
      )}
    </div>
  );
}
