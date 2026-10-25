import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { speakerName } from "../domain/format";
import { NODE_LABEL } from "../domain/labels";
import type { DialogueLine, ProjectDocument, StoryNode } from "../domain/types";
import { useProjectStore } from "../store/projectStore";

export type StoryNodeData = Record<string, unknown> & { story: StoryNode };
export type StoryFlowNode = Node<StoryNodeData, "story">;

export function StoryNodeCard({ data, selected }: NodeProps<StoryFlowNode>) {
  const story = data.story;
  const project = useProjectStore((state) => state.project);
  const openSubgraph = useProjectStore((state) => state.openSubgraph);
  const hasOutgoing = useProjectStore((state) => {
    const current = state.currentGraphId ? state.graphs[state.currentGraphId] : undefined;
    return current?.edges.some((edge) => edge.source === story.id) ?? false;
  });
  const title = story.title.trim();
  const lines = story.type === "dialogue" ? story.lines : [];
  const summary = lines.length === 0 ? story.summary.trim() : "";

  return (
    <article
      className={`sp-node sp-type-${story.type}${selected ? " is-selected" : ""}`}
      onDoubleClickCapture={(event) => {
        // Capture runs before the pane's dblclick zoom listener. A node
        // double-click never zooms. It opens an inner graph only when one exists.
        event.preventDefault();
        event.stopPropagation();
        if (story.subgraphId) openSubgraph(story.id);
      }}
    >
      <Handle type="target" position={Position.Left} id="in" />
      <header>
        <span>{NODE_LABEL[story.type]}</span>
        {story.subgraphId && (
          <span className="sp-node-nest" title="Inner graph">
            ↳
          </span>
        )}
      </header>
      {title && <h3>{title}</h3>}
      {lines.length > 0 && (
        <ul className="sp-node-lines">
          {lines.map((line) => (
            <li key={line.id}>{lineText(line, project)}</li>
          ))}
        </ul>
      )}
      {summary && <p>{summary}</p>}
      {story.type !== "end" ? (
        <Handle type="source" position={Position.Right} id="out" className="sp-handle-out" />
      ) : (
        hasOutgoing && <Handle type="source" position={Position.Right} id="out" className="sp-handle-out" isConnectable={false} />
      )}
    </article>
  );
}

function lineText(line: DialogueLine, project: ProjectDocument | null): string {
  const speaker = project ? speakerName(project, line.speakerTagId) : "Narration";
  return `${speaker}: ${line.text}`;
}
