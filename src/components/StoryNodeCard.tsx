import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NODE_LABEL } from "../domain/labels";
import { speakerName } from "../domain/format";
import type { StoryNode } from "../domain/types";
import { useProjectStore } from "../store/projectStore";

export type StoryNodeData = Record<string, unknown> & { story: StoryNode };
export type StoryFlowNode = Node<StoryNodeData, "story">;

export function StoryNodeCard({ data, selected }: NodeProps<StoryFlowNode>) {
  const story = data.story;
  const project = useProjectStore((state) => state.project);
  const openSubgraph = useProjectStore((state) => state.openSubgraph);
  const first = story.lines[0];
  const preview = first
    ? `${speakerName(project ?? emptyProject(), first.speakerTagId)}: ${first.text}`
    : story.summary;

  return (
    <article className={`sp-node sp-type-${story.type}${selected ? " is-selected" : ""}`}>
      {story.type !== "start" && <Handle type="target" position={Position.Left} id="in" />}
      <header>
        <span>{NODE_LABEL[story.type]}</span>
        {story.subgraphId && <em>Nested</em>}
      </header>
      <h3>{story.title || "Untitled"}</h3>
      {preview && <p>{preview}</p>}
      <footer>
        {story.choices.length > 0 && <span>{story.choices.length} choices</span>}
        {story.effects.length > 0 && <span>Sets variables</span>}
        {(story.type === "event" || story.type === "scene" || story.type === "dialogue") && (
          <button
            type="button"
            className="nodrag sp-node-open"
            onClick={(event) => {
              event.stopPropagation();
              openSubgraph(story.id);
            }}
          >
            {story.subgraphId ? "Open" : "Inner graph"}
          </button>
        )}
      </footer>
      {story.choices.map((choice) => (
        <div key={choice.id} className="sp-choice-port">
          <span>{choice.label || "Choice"}</span>
          <Handle type="source" position={Position.Right} id={choice.id} />
        </div>
      ))}
      {story.type !== "end" && (
        <Handle type="source" position={Position.Right} id="out" className="sp-handle-out" />
      )}
    </article>
  );
}

function emptyProject() {
  return {
    schemaVersion: 1,
    id: "",
    name: "",
    createdAt: "",
    updatedAt: "",
    rootGraphId: "",
    variables: [],
    tagCategories: [],
  };
}
