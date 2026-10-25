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

  const hasOutgoing = useProjectStore((state) => {
    const current = state.currentGraphId ? state.graphs[state.currentGraphId] : undefined;
    return current?.edges.some((edge) => edge.source === story.id) ?? false;
  });
  const canOpen = story.type === "event" || story.type === "scene" || story.type === "dialogue";
  return (
    <article
      className={`sp-node sp-type-${story.type}${selected ? " is-selected" : ""}`}
      onDoubleClickCapture={(event) => {
        // Capture runs before the pane's dblclick zoom listener, so a node
        // double-click drills in instead of zooming. Empty canvas still zooms.
        event.preventDefault();
        event.stopPropagation();
        if (canOpen) openSubgraph(story.id);
      }}
    >
      <Handle type="target" position={Position.Left} id="in" />
      <header>
        <span>{NODE_LABEL[story.type]}</span>
        {story.subgraphId && <em>Nested</em>}
      </header>
      <h3>{story.title || "Untitled"}</h3>
      {preview && <p>{preview}</p>}
      <footer>
        {story.lines.length > 0 && <span>{story.lines.length} lines</span>}
        {canOpen && (
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
      {story.type !== "end" ? (
        <Handle type="source" position={Position.Right} id="out" className="sp-handle-out" />
      ) : (
        hasOutgoing && <Handle type="source" position={Position.Right} id="out" className="sp-handle-out" isConnectable={false} />
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
