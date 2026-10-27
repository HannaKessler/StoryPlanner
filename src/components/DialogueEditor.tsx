import { useState } from "react";
import type { DialogueLine } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { menuHandler } from "./ContextMenu";
import { IconButton } from "./Panel";

export function DialogueEditor({ nodeId, lines }: { nodeId: string; lines: DialogueLine[] }) {
  const updateLine = useProjectStore((state) => state.updateLine);
  const deleteLine = useProjectStore((state) => state.deleteLine);
  const moveLine = useProjectStore((state) => state.moveLine);
  const addLine = useProjectStore((state) => state.addLine);

  if (lines.length === 0) return null;
  return (
    <ol className="sp-lines">
      {lines.map((line, index) => (
        <li
          key={line.id}
          className="sp-line"
          onContextMenu={menuHandler(() => [
            { label: "Add line", onSelect: () => addLine(nodeId) },
            "separator",
            { label: "Delete line", danger: true, onSelect: () => deleteLine(nodeId, line.id) },
          ])}
        >
          <div className="sp-line-top">
            <span className="sp-line-no">{index + 1}</span>
            <SpeakerPicker value={line.speakerId} onChange={(speakerId) => updateLine(nodeId, line.id, { speakerId })} />
            <input
              className="sp-cell sp-line-dir"
              aria-label="Line direction"
              placeholder="(direction)"
              value={line.direction}
              onChange={(event) => updateLine(nodeId, line.id, { direction: event.target.value })}
            />
            <IconButton label="Move line up" disabled={index === 0} onClick={() => moveLine(nodeId, line.id, -1)}>
              ↑
            </IconButton>
            <IconButton label="Move line down" disabled={index === lines.length - 1} onClick={() => moveLine(nodeId, line.id, 1)}>
              ↓
            </IconButton>
            <IconButton label="Delete line" danger onClick={() => deleteLine(nodeId, line.id)}>
              ×
            </IconButton>
          </div>
          <textarea
            className="sp-cell sp-area sp-story-input"
            rows={2}
            aria-label="Line text"
            placeholder="What they say"
            value={line.text}
            onChange={(event) => updateLine(nodeId, line.id, { text: event.target.value })}
          />
        </li>
      ))}
    </ol>
  );
}

export function SpeakerPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (speakerId: string | null) => void;
}) {
  const project = useProjectStore((state) => state.project);
  const addEntity = useProjectStore((state) => state.addEntity);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  if (!project) return null;

  if (adding) {
    return (
      <form
        className="sp-speaker"
        onSubmit={(event) => {
          event.preventDefault();
          const id = addEntity("character", name);
          if (id) onChange(id);
          setName("");
          setAdding(false);
        }}
      >
        <input
          className="sp-cell"
          value={name}
          aria-label="New character name"
          onChange={(event) => setName(event.target.value)}
          onBlur={() => !name.trim() && setAdding(false)}
          autoFocus
        />
      </form>
    );
  }

  return (
    <select
      className="sp-cell sp-speaker"
      aria-label="Speaker"
      value={value ?? ""}
      onChange={(event) => {
        if (event.target.value === "__new__") {
          setAdding(true);
          return;
        }
        onChange(event.target.value || null);
      }}
    >
      <option value="">Narration</option>
      {project.characters.map((character) => (
        <option key={character.id} value={character.id}>
          {character.name || "Untitled"}
        </option>
      ))}
      <option value="__new__">+ character</option>
    </select>
  );
}
