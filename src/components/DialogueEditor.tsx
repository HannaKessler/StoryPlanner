import { useState } from "react";
import { entityLabel } from "../domain/names";
import type { DialogueLine } from "../domain/types";
import { CreateField } from "./CreateField";
import { useProjectStore } from "../store/projectStore";
import { menuHandler } from "./ContextMenu";
import { AutoTextarea, IconButton } from "./Panel";

/** Focuses the text of a dialogue line once it is drawn. */
export function focusLine(lineId: string | null) {
  if (!lineId) return;
  window.setTimeout(() => document.querySelector<HTMLTextAreaElement>(`[data-line="${CSS.escape(lineId)}"]`)?.focus(), 30);
}

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
            { label: "Add line", onSelect: () => focusLine(addLine(nodeId, line.id)) },
            "separator",
            { label: "Delete line", danger: true, onSelect: () => deleteLine(nodeId, line.id) },
          ])}
        >
          <span className="sp-line-no">{index + 1}</span>
          <SpeakerPicker value={line.speakerId} onChange={(speakerId) => updateLine(nodeId, line.id, { speakerId })} />
          <input
            className="sp-cell sp-line-dir"
            aria-label="Line direction"
            placeholder="(direction)"
            value={line.direction}
            onChange={(event) => updateLine(nodeId, line.id, { direction: event.target.value })}
          />
          <AutoTextarea
            className="sp-cell sp-area sp-story-input sp-line-text"
            minRows={1}
            maxRows={12}
            aria-label="Line text"
            data-line={line.id}
            value={line.text}
            onChange={(event) => updateLine(nodeId, line.id, { text: event.target.value })}
            onKeyDown={(event) => {
              // Enter starts the next line with the same speaker. Shift+Enter keeps a line break.
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              focusLine(addLine(nodeId, line.id));
            }}
          />
          <span className="sp-line-tools">
            <IconButton label="Move line up" disabled={index === 0} onClick={() => moveLine(nodeId, line.id, -1)}>
              ↑
            </IconButton>
            <IconButton label="Move line down" disabled={index === lines.length - 1} onClick={() => moveLine(nodeId, line.id, 1)}>
              ↓
            </IconButton>
            <IconButton label="Delete line" danger onClick={() => deleteLine(nodeId, line.id)}>
              ×
            </IconButton>
          </span>
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
  const [adding, setAdding] = useState(false);
  if (!project) return null;

  if (adding) {
    return (
      <span className="sp-speaker">
        <CreateField kind="character" label="Speaker name" onPick={(id) => onChange(id)} onClose={() => setAdding(false)} />
      </span>
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
          {entityLabel(project, character)}
        </option>
      ))}
      <option value="__new__">+ character</option>
    </select>
  );
}
