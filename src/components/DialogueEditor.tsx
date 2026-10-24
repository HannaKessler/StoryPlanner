import { useState } from "react";
import { characterCategories } from "../domain/format";
import type { DialogueLine } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { Field } from "./Modal";

export function DialogueEditor({ nodeId, lines }: { nodeId: string; lines: DialogueLine[] }) {
  const addLine = useProjectStore((state) => state.addLine);
  const updateLine = useProjectStore((state) => state.updateLine);
  const deleteLine = useProjectStore((state) => state.deleteLine);
  const moveLine = useProjectStore((state) => state.moveLine);

  return (
    <div className="sp-lines">
      {lines.length === 0 && <p className="sp-muted">No lines yet.</p>}
      {lines.map((line, index) => (
        <article key={line.id} className="sp-line">
          <header>
            <span>Line {index + 1}</span>
            <span className="sp-inline">
              <button type="button" className="sp-icon-btn" disabled={index === 0} onClick={() => moveLine(nodeId, line.id, -1)} aria-label="Move line up">
                ↑
              </button>
              <button type="button" className="sp-icon-btn" disabled={index === lines.length - 1} onClick={() => moveLine(nodeId, line.id, 1)} aria-label="Move line down">
                ↓
              </button>
              <button type="button" className="sp-icon-btn" onClick={() => deleteLine(nodeId, line.id)} aria-label="Delete line">
                ×
              </button>
            </span>
          </header>
          <SpeakerPicker value={line.speakerTagId} onChange={(speakerTagId) => updateLine(nodeId, line.id, { speakerTagId })} />
          <textarea
            className="sp-textarea sp-story-input"
            rows={3}
            placeholder="What they say"
            value={line.text}
            onChange={(event) => updateLine(nodeId, line.id, { text: event.target.value })}
          />
          <Field label="Line note">
            <input
              className="sp-input"
              placeholder="quietly, without looking up"
              value={line.direction}
              onChange={(event) => updateLine(nodeId, line.id, { direction: event.target.value })}
            />
          </Field>
        </article>
      ))}
      <button type="button" className="sp-btn sp-btn-small" onClick={() => addLine(nodeId)}>
        + Line
      </button>
    </div>
  );
}

export function SpeakerPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (speakerTagId: string | null) => void;
}) {
  const project = useProjectStore((state) => state.project);
  const addTag = useProjectStore((state) => state.addTag);
  const ensureCharacterCategory = useProjectStore((state) => state.ensureCharacterCategory);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  if (!project) return null;
  const categories = characterCategories(project);

  return (
    <div className="sp-speaker">
      <select
        className="sp-select"
        aria-label="Speaker"
        value={value ?? ""}
        onChange={(event) => {
          if (event.target.value === "__new__") {
            const category = categories[0]?.id ?? ensureCharacterCategory() ?? "";
            setCategoryId(category);
            setAdding(true);
            return;
          }
          onChange(event.target.value || null);
        }}
      >
        <option value="">Narration</option>
        {categories.map((category) => (
          <optgroup key={category.id} label={category.name}>
            {category.tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </optgroup>
        ))}
        <option value="__new__">+ New character</option>
      </select>
      {adding && (
        <form
          className="sp-inline"
          onSubmit={(event) => {
            event.preventDefault();
            const category = categoryId || ensureCharacterCategory();
            if (!category) return;
            const id = addTag(category, name);
            if (id) onChange(id);
            setName("");
            setAdding(false);
          }}
        >
          {categories.length > 1 && (
            <select className="sp-select" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          )}
          <input className="sp-input" value={name} placeholder="Character name" onChange={(event) => setName(event.target.value)} autoFocus />
          <button type="submit" className="sp-btn sp-btn-small">
            Add
          </button>
        </form>
      )}
    </div>
  );
}
