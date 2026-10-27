import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { describeEffect } from "../domain/effects";
import { entityName, speakerName } from "../domain/format";
import type { NodeInvolvement } from "../domain/involved";
import type { DialogueLine, ProjectDocument, StoryNode } from "../domain/types";
import { useProjectStore } from "../store/projectStore";

export type StoryNodeData = Record<string, unknown> & {
  story: StoryNode;
  involvement: NodeInvolvement;
};
export type StoryFlowNode = Node<StoryNodeData, "story">;

export function StoryNodeCard({ data, selected }: NodeProps<StoryFlowNode>) {
  const story = data.story;
  const project = useProjectStore((state) => state.project);
  const openSubgraph = useProjectStore((state) => state.openSubgraph);
  const title = story.title.trim();
  const summary = story.summary.trim();
  const own = data.involvement?.own;
  const all = data.involvement?.all;

  return (
    <article
      className={`sp-node${selected ? " is-selected" : ""}`}
      onDoubleClickCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (story.subgraphId) openSubgraph(story.id);
      }}
    >
      <Handle type="target" position={Position.Left} id="in" />
      {(story.subgraphId || title) && (
        <header>
          {title ? <h3>{title}</h3> : <span />}
          {story.subgraphId && (
            <span className="sp-node-nest" title="Sub-graph">
              ↳
            </span>
          )}
        </header>
      )}
      {project && <RefLine ids={all?.locationIds ?? []} own={own?.locationIds ?? []} project={project} />}
      {project && <RefLine ids={all?.characterIds ?? []} own={own?.characterIds ?? []} project={project} kind="who" />}
      {project && <RefLine ids={all?.itemIds ?? []} own={own?.itemIds ?? []} project={project} kind="item" />}
      {summary && <p>{summary}</p>}
      {story.lines.length > 0 && (
        <ul className="sp-node-lines">
          {story.lines.map((line) => (
            <li key={line.id}>{lineText(line, project)}</li>
          ))}
        </ul>
      )}
      {project && story.effects.length > 0 && (
        <ul className="sp-node-fx">
          {story.effects.map((effect) => (
            <li key={effect.id}>{describeEffect(effect, project)}</li>
          ))}
        </ul>
      )}
      <Handle type="source" position={Position.Right} id="out" className="sp-handle-out" />
    </article>
  );
}

function RefLine({
  ids,
  own,
  project,
  kind,
}: {
  ids: string[];
  own: string[];
  project: ProjectDocument;
  kind?: "who" | "item";
}) {
  if (ids.length === 0) return null;
  const ownSet = new Set(own);
  return (
    <p className={`sp-node-refs${kind ? ` is-${kind}` : ""}`}>
      {ids.map((id) => (
        <span key={id} className={ownSet.has(id) ? "sp-ref" : "sp-ref is-inherited"} title={ownSet.has(id) ? undefined : "Sub-graph"}>
          {entityName(project, id)}
        </span>
      ))}
    </p>
  );
}

function lineText(line: DialogueLine, project: ProjectDocument | null): string {
  const speaker = project ? speakerName(project, line.speakerId) : "Narration";
  return `${speaker}: ${line.text}`;
}
