import { useState } from "react";
import { TAG_COLORS } from "../domain/factories";
import { useProjectStore } from "../store/projectStore";
import { Field } from "./Modal";

export function TagsManager() {
  const project = useProjectStore((state) => state.project);
  const addCategory = useProjectStore((state) => state.addCategory);
  const updateCategory = useProjectStore((state) => state.updateCategory);
  const deleteCategory = useProjectStore((state) => state.deleteCategory);
  const addTag = useProjectStore((state) => state.addTag);
  const updateTag = useProjectStore((state) => state.updateTag);
  const deleteTag = useProjectStore((state) => state.deleteTag);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tagName, setTagName] = useState("");
  if (!project) return null;
  const selected = project.tagCategories.find((category) => category.id === selectedId) ?? project.tagCategories[0];

  return (
    <section className="sp-page sp-tags">
      <header className="sp-page-head">
        <div>
          <p className="sp-kicker">Project</p>
          <h2>Tags</h2>
          <p className="sp-muted">
            Make your own categories. Mark one as characters and its tags become speakers. New tags can also be added from a line or a condition.
          </p>
        </div>
        <button type="button" className="sp-btn" onClick={addCategory}>
          + Category
        </button>
      </header>
      <div className="sp-tags-body">
        <ul className="sp-cat-list">
          {project.tagCategories.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                className={selected?.id === category.id ? "is-active" : ""}
                onClick={() => setSelectedId(category.id)}
              >
                <strong>{category.name}</strong>
                <span>
                  {category.tags.length} tags{category.isCharacters ? " · speakers" : ""}
                </span>
              </button>
            </li>
          ))}
          {project.tagCategories.length === 0 && <li className="sp-muted">No categories yet.</li>}
        </ul>
        {selected && (
          <div className="sp-cat-detail">
            <Field label="Category name">
              <input className="sp-input" value={selected.name} onChange={(event) => updateCategory(selected.id, { name: event.target.value })} />
            </Field>
            <Field label="Description">
              <input
                className="sp-input"
                value={selected.description}
                onChange={(event) => updateCategory(selected.id, { description: event.target.value })}
              />
            </Field>
            <label className="sp-check">
              <input
                type="checkbox"
                checked={selected.isCharacters}
                onChange={(event) => updateCategory(selected.id, { isCharacters: event.target.checked })}
              />
              Use as characters — tags here can speak dialogue
            </label>
            <form
              className="sp-inline"
              onSubmit={(event) => {
                event.preventDefault();
                addTag(selected.id, tagName);
                setTagName("");
              }}
            >
              <input className="sp-input" value={tagName} placeholder="New tag" onChange={(event) => setTagName(event.target.value)} />
              <button type="submit" className="sp-btn sp-btn-small">
                Add tag
              </button>
            </form>
            <ul className="sp-tag-list">
              {selected.tags.map((tag) => (
                <li key={tag.id}>
                  <input
                    className="sp-input"
                    value={tag.name}
                    onChange={(event) => updateTag(selected.id, tag.id, { name: event.target.value })}
                  />
                  <div className="sp-swatches">
                    {TAG_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={tag.color === color ? "is-active" : ""}
                        style={{ background: color }}
                        aria-label={color}
                        onClick={() => updateTag(selected.id, tag.id, { color })}
                      />
                    ))}
                  </div>
                  <button type="button" className="sp-icon-btn" aria-label={`Delete ${tag.name}`} onClick={() => deleteTag(selected.id, tag.id)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="sp-btn is-danger" onClick={() => deleteCategory(selected.id)}>
              Delete category
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
