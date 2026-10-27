import { useState } from "react";
import { entitiesOf } from "../domain/format";
import { beatLabel, shortBeatLabel } from "../domain/labels";
import { entityLabel } from "../domain/names";
import { orderBeats } from "../domain/outline";
import type { EntityKind, GraphDocument, ProjectDocument, StoryNode } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { ConditionBuilder } from "./ConditionBuilder";
import { CreateField } from "./CreateField";
import { DialogueEditor, focusLine } from "./DialogueEditor";
import { EffectsEditor } from "./EffectsEditor";
import { AutoTextarea, IconButton } from "./Panel";

/** The selected beat as a page. Same fields as the inspector, laid out for writing. */
export function WriteMode() {
  const project = useProjectStore((state) => state.project);
  const graph = useProjectStore((state) => (state.currentGraphId ? state.graphs[state.currentGraphId] : undefined));
  const selection = useProjectStore((state) => state.selection);
  if (!project || !graph) return <div className="sp-write" />;
  const nodeId =
    selection?.kind === "node" ? selection.id : selection?.kind === "edge" ? graph.edges.find((edge) => edge.id === selection.id)?.source : undefined;
  const node = graph.nodes.find((item) => item.id === nodeId);
  return (
    <div className="sp-write">
      {node ? <WritePage key={node.id} project={project} graph={graph} node={node} /> : <div className="sp-write-page" />}
    </div>
  );
}

function WritePage({ project, graph, node }: { project: ProjectDocument; graph: GraphDocument; node: StoryNode }) {
  const updateNode = useProjectStore((state) => state.updateNode);
  const addLine = useProjectStore((state) => state.addLine);
  const graphs = useProjectStore((state) => state.graphs);
  const child = node.subgraphId ? graphs[node.subgraphId] : undefined;

  return (
    <article className="sp-write-page">
      <AutoTextarea
        className="sp-write-title"
        aria-label="Title"
        placeholder={beatLabel(node, project)}
        data-rename={node.id}
        minRows={1}
        maxRows={4}
        value={node.title}
        onChange={(event) => updateNode(node.id, { title: event.target.value.replace(/\s*\n\s*/g, " ") })}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            document.querySelector<HTMLTextAreaElement>(".sp-write-summary")?.focus();
          }
        }}
      />

      <div className="sp-write-chips">
        <RefChips
          kind="location"
          project={project}
          ids={node.locationId ? [node.locationId] : []}
          onChange={(ids) => updateNode(node.id, { locationId: ids.at(-1) ?? null })}
        />
        <RefChips kind="character" project={project} ids={node.characterIds} onChange={(characterIds) => updateNode(node.id, { characterIds })} />
        <RefChips kind="item" project={project} ids={node.itemIds} onChange={(itemIds) => updateNode(node.id, { itemIds })} />
      </div>

      <h3 className="sp-write-label">Summary</h3>
      <AutoTextarea
        className="sp-write-prose sp-write-summary"
        aria-label="Summary"
        minRows={2}
        maxRows={40}
        value={node.summary}
        onChange={(event) => updateNode(node.id, { summary: event.target.value })}
      />

      <h3 className="sp-write-label">Scene notes</h3>
      <AutoTextarea
        className="sp-write-prose"
        aria-label="Scene notes"
        minRows={2}
        maxRows={40}
        value={node.sceneNotes}
        onChange={(event) => updateNode(node.id, { sceneNotes: event.target.value })}
      />

      <h3 className="sp-write-label">Lines</h3>
      <div className="sp-write-lines">
        <DialogueEditor nodeId={node.id} lines={node.lines} />
        <button type="button" className="sp-chip-btn" onClick={() => focusLine(addLine(node.id, node.lines.at(-1)?.id))}>
          + line
        </button>
      </div>

      {child && child.nodes.length > 0 && (
        <>
          <h3 className="sp-write-label">Sub-graph</h3>
          <ul className="sp-write-links">
            {orderBeats(child).map((beat) => (
              <li key={beat.id}>
                <button type="button" onClick={() => useProjectStore.getState().selectBeat(child.id, beat.id)}>
                  {beatLabel(beat, project)}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Logic project={project} graph={graph} node={node} />
    </article>
  );
}

const KIND_ADD: Record<"location" | "character" | "item", string> = {
  location: "+ location",
  character: "+ character",
  item: "+ item",
};

function RefChips({
  kind,
  project,
  ids,
  onChange,
}: {
  kind: "location" | "character" | "item";
  project: ProjectDocument;
  ids: string[];
  onChange: (ids: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const entities = entitiesOf(project, kind as EntityKind);
  return (
    <>
      {ids.map((id) => {
        const entity = entities.find((item) => item.id === id);
        const name = entity ? entityLabel(project, entity) : "missing";
        return (
          <button
            key={id}
            type="button"
            className={`sp-chip-btn is-on sp-write-chip is-${kind}`}
            aria-label={`Delete ${name}`}
            onClick={() => onChange(ids.filter((item) => item !== id))}
          >
            {name} <span aria-hidden="true">×</span>
          </button>
        );
      })}
      {adding ? (
        <CreateField
          kind={kind as EntityKind}
          label={`${kind[0].toUpperCase()}${kind.slice(1)} name`}
          exclude={ids}
          onPick={(id) => onChange(kind === "location" ? [id] : ids.includes(id) ? ids : [...ids, id])}
          onClose={() => setAdding(false)}
        />
      ) : (
        <button type="button" className="sp-chip-btn sp-write-add" onClick={() => setAdding(true)}>
          {KIND_ADD[kind]}
        </button>
      )}
    </>
  );
}

function Logic({ project, graph, node }: { project: ProjectDocument; graph: GraphDocument; node: StoryNode }) {
  const addNodeEffect = useProjectStore((state) => state.addNodeEffect);
  const updateNodeEffect = useProjectStore((state) => state.updateNodeEffect);
  const deleteNodeEffect = useProjectStore((state) => state.deleteNodeEffect);
  const moveNodeEffect = useProjectStore((state) => state.moveNodeEffect);
  const updateEdge = useProjectStore((state) => state.updateEdge);
  const deleteEdges = useProjectStore((state) => state.deleteEdges);
  const connectNodes = useProjectStore((state) => state.connectNodes);
  const outgoing = graph.edges.filter((edge) => edge.source === node.id);
  const linked = new Set(outgoing.map((edge) => edge.target));
  const targets = graph.nodes.filter((item) => item.id !== node.id && !linked.has(item.id));
  const count = node.effects.length + outgoing.length;
  return (
    <details className="sp-write-logic">
      <summary>
        Logic <span className="sp-sec-count">{count}</span>
      </summary>
      <h4 className="sp-write-label">Effects</h4>
      <EffectsEditor
        effects={node.effects}
        onAdd={() => addNodeEffect(node.id)}
        onUpdate={(effectId, patch) => updateNodeEffect(node.id, effectId, patch)}
        onDelete={(effectId) => deleteNodeEffect(node.id, effectId)}
        onMove={(effectId, direction) => moveNodeEffect(node.id, effectId, direction)}
      />
      <button type="button" className="sp-chip-btn" disabled={project.variables.length === 0} onClick={() => addNodeEffect(node.id)}>
        + effect
      </button>

      <h4 className="sp-write-label">Transitions</h4>
      <ul className="sp-write-trans">
        {outgoing.map((edge) => {
          const target = graph.nodes.find((item) => item.id === edge.target);
          return (
            <li key={edge.id}>
              <div className="sp-write-trans-head">
                <input
                  className="sp-cell"
                  aria-label="Transition label"
                  placeholder="Label"
                  value={edge.label}
                  onChange={(event) => updateEdge(edge.id, { label: event.target.value })}
                />
                <span className="sp-faint">→ {target ? beatLabel(target, project) : "Missing beat"}</span>
                <IconButton label="Delete transition" danger onClick={() => deleteEdges([edge.id])}>
                  ×
                </IconButton>
              </div>
              <ConditionBuilder value={edge.condition} onChange={(condition) => updateEdge(edge.id, { condition })} />
            </li>
          );
        })}
      </ul>
      {targets.length > 0 && (
        <select
          className="sp-chip-select"
          aria-label="Add a transition to"
          value=""
          onChange={(event) => event.target.value && connectNodes(node.id, event.target.value)}
        >
          <option value="">+ to…</option>
          {targets.map((item) => (
            <option key={item.id} value={item.id}>
              {shortBeatLabel(item, project)}
            </option>
          ))}
        </select>
      )}
    </details>
  );
}
