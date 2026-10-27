import { useState } from "react";
import { graphName } from "../domain/graphOps";
import { entityLabel } from "../domain/names";
import { describeCondition } from "../domain/conditions";
import { describeEffect } from "../domain/effects";
import { entityName } from "../domain/format";
import { involvedIndex, involvement } from "../domain/involved";
import { beatLabel, shortBeatLabel } from "../domain/labels";
import type { GraphDocument, ProjectDocument, StoryEdge, StoryEntity } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { ConditionBuilder } from "./ConditionBuilder";
import { DialogueEditor, focusLine } from "./DialogueEditor";
import { EffectsEditor } from "./EffectsEditor";
import { focusRename, menuHandler, type MenuItem } from "./ContextMenu";
import { conditionAddItems } from "./menuItems";
import { AutoTextarea, IconButton, Row, Section } from "./Panel";

export function Inspector() {
  const selection = useProjectStore((state) => state.selection);
  const graph = useProjectStore((state) => (state.currentGraphId ? state.graphs[state.currentGraphId] : null));
  if (!graph) return null;
  let body = <GraphInspector graph={graph} />;
  if (selection?.kind === "edge" && graph.edges.some((item) => item.id === selection.id)) {
    body = <EdgeInspector key={selection.id} graph={graph} edgeId={selection.id} />;
  } else if (selection?.kind === "node" && graph.nodes.some((item) => item.id === selection.id)) {
    body = <NodeInspector key={selection.id} graph={graph} nodeId={selection.id} />;
  }
  // The scroll area is inside the aside, so a head button placed after the fields stays pinned.
  return (
    <aside className="sp-inspector">
      <div className="sp-insp-scroll sp-panel">{body}</div>
    </aside>
  );
}

function GraphInspector({ graph }: { graph: GraphDocument }) {
  const updateGraphMeta = useProjectStore((state) => state.updateGraphMeta);
  const graphs = useProjectStore((state) => state.graphs);
  const project = useProjectStore((state) => state.project);
  const nested = Boolean(graph.parentNodeId);
  // A sub-graph's notes live on its beat. Older files may still have some here, so those stay visible.
  const showNotes = !nested || graph.sceneNotes.trim() !== "";
  return (
    <>
      <div className="sp-insp-head">
        <span className="sp-kicker">{nested ? "Sub-graph" : "Graph"}</span>
        <input
          className="sp-head-input"
          aria-label={nested ? "Sub-graph name" : "Graph name"}
          placeholder={nested ? graphName({ ...graph, name: "" }, graphs, project) : undefined}
          value={graph.name}
          onChange={(event) => updateGraphMeta({ name: event.target.value })}
        />
      </div>
      {showNotes && (
        <Section id="insp:graph-notes" title="Scene notes" summary={graph.sceneNotes}>
          <textarea
            className="sp-cell sp-area"
            rows={3}
            aria-label="Scene notes"
            value={graph.sceneNotes}
            onChange={(event) => updateGraphMeta({ sceneNotes: event.target.value })}
          />
        </Section>
      )}
    </>
  );
}

function NodeInspector({ graph, nodeId }: { graph: GraphDocument; nodeId: string }) {
  const project = useProjectStore((state) => state.project);
  const graphs = useProjectStore((state) => state.graphs);
  const updateNode = useProjectStore((state) => state.updateNode);
  const openSubgraph = useProjectStore((state) => state.openSubgraph);
  const requestDeleteSubgraph = useProjectStore((state) => state.requestDeleteSubgraph);
  const requestDeleteNodes = useProjectStore((state) => state.requestDeleteNodes);
  const connectNodes = useProjectStore((state) => state.connectNodes);
  const addLine = useProjectStore((state) => state.addLine);
  const addNodeEffect = useProjectStore((state) => state.addNodeEffect);
  const updateNodeEffect = useProjectStore((state) => state.updateNodeEffect);
  const deleteNodeEffect = useProjectStore((state) => state.deleteNodeEffect);
  const moveNodeEffect = useProjectStore((state) => state.moveNodeEffect);
  const currentGraphId = useProjectStore((state) => state.currentGraphId);
  const node = graph.nodes.find((item) => item.id === nodeId);
  const involved = involvedIndex(graphs);
  if (!node || !project || !currentGraphId) return null;
  const child = node.subgraphId ? graphs[node.subgraphId] : undefined;
  const info = involvement(involved, currentGraphId, node.id);
  const fromSub = `From sub-graph: ${child ? graphName(child, graphs, project) : ""}`;
  const outgoing = graph.edges.filter((edge) => edge.source === node.id);
  const linked = new Set(outgoing.map((edge) => edge.target));
  const targets = graph.nodes.filter((item) => item.id !== node.id && !linked.has(item.id));
  const addTransitionItems = (): MenuItem[] =>
    targets.length === 0
      ? [{ label: "Add transition", disabled: true, onSelect: () => undefined }]
      : targets.map((item) => ({ label: `Add transition to ${shortBeatLabel(item, project)}`, onSelect: () => connectNodes(node.id, item.id) }));

  return (
    <>
      <div className="sp-insp-head">
        <span className="sp-kicker">Beat</span>
        <AutoTextarea
          className="sp-head-input sp-head-area"
          aria-label="Title"
          placeholder="Title"
          data-rename={node.id}
          minRows={1}
          maxRows={3}
          value={node.title}
          onChange={(event) => updateNode(node.id, { title: event.target.value.replace(/\s*\n\s*/g, " ") })}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      </div>

      <Section id="insp:location" title="Location">
        <select
          className="sp-cell"
          aria-label="Location"
          value={node.locationId ?? ""}
          onChange={(event) => updateNode(node.id, { locationId: event.target.value || null })}
        >
          <option value="">None</option>
          {project.locations.map((location) => (
            <option key={location.id} value={location.id}>
              {entityLabel(project, location)}
            </option>
          ))}
        </select>
        <Inherited ids={info.inherited.locationIds} project={project} from={fromSub} />
      </Section>

      <Section id="insp:characters" title="Characters">
        <EntityChips
          project={project}
          names={project.characters}
          selected={node.characterIds}
          onChange={(characterIds) => updateNode(node.id, { characterIds })}
        />
        <Inherited ids={info.inherited.characterIds} project={project} from={fromSub} />
      </Section>

      <Section id="insp:items" title="Items">
        <EntityChips
          project={project}
          names={project.items}
          selected={node.itemIds}
          onChange={(itemIds) => updateNode(node.id, { itemIds })}
        />
        <Inherited ids={info.inherited.itemIds} project={project} from={fromSub} />
      </Section>

      {child && (
        <div className="sp-inner-row" title="Sub-graph">
          <span className="sp-inner-name">↳ {graphName(child, graphs, project)}</span>
          <button type="button" className="sp-chip-btn" onClick={() => openSubgraph(node.id)}>
            Open
          </button>
          <IconButton label="Remove sub-graph" danger onClick={() => requestDeleteSubgraph(node.id)}>
            ×
          </IconButton>
        </div>
      )}

      <Section id="insp:notes" title="Notes" summary={node.summary || node.sceneNotes}>
          <textarea
            className="sp-cell sp-area"
            rows={2}
            aria-label="Summary"
            placeholder="Summary"
            value={node.summary}
            onChange={(event) => updateNode(node.id, { summary: event.target.value })}
          />
          <textarea
            className="sp-cell sp-area"
            rows={2}
            aria-label="Scene notes"
            placeholder="Scene notes"
            value={node.sceneNotes}
            onChange={(event) => updateNode(node.id, { sceneNotes: event.target.value })}
          />
        </Section>

      <Section
        id="insp:effects"
        title="Effects"
        count={node.effects.length}
        summary={node.effects.map((effect) => describeEffect(effect, project)).join(", ")}
        onContextMenu={menuHandler(() => [
          { label: "Add effect", disabled: project.variables.length === 0, onSelect: () => addNodeEffect(node.id) },
        ])}
        actions={
          <button type="button" className="sp-chip-btn" disabled={project.variables.length === 0} onClick={() => addNodeEffect(node.id)}>
            + effect
          </button>
        }
      >
        <EffectsEditor
          effects={node.effects}
          onAdd={() => addNodeEffect(node.id)}
          onUpdate={(effectId, patch) => updateNodeEffect(node.id, effectId, patch)}
          onDelete={(effectId) => deleteNodeEffect(node.id, effectId)}
          onMove={(effectId, direction) => moveNodeEffect(node.id, effectId, direction)}
        />
      </Section>

      {(
        <Section
          id="insp:lines"
          title="Lines"
          count={node.lines.length}
          onContextMenu={menuHandler(() => [{ label: "Add line", onSelect: () => focusLine(addLine(node.id)) }])}
          actions={
            <button type="button" className="sp-chip-btn" onClick={() => focusLine(addLine(node.id))}>
              + line
            </button>
          }
        >
          <DialogueEditor nodeId={node.id} lines={node.lines} />
        </Section>
      )}

      {(
        <Section
          id="insp:out"
          title="Transitions out"
          count={outgoing.length}
          onContextMenu={menuHandler(addTransitionItems)}
          actions={
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
          }
        >
          <TransitionList graph={graph} edges={outgoing} project={project} side="target" reorder addItems={addTransitionItems} />
        </Section>
      )}

      <span className="sp-insp-pin">
        <IconButton label="Delete beat" danger onClick={() => requestDeleteNodes([node.id])}>
          ×
        </IconButton>
      </span>
    </>
  );
}

function TransitionList({
  graph,
  edges,
  project,
  side,
  reorder = false,
  addItems,
}: {
  graph: GraphDocument;
  edges: StoryEdge[];
  project: ProjectDocument;
  side: "source" | "target";
  reorder?: boolean;
  addItems?: () => MenuItem[];
}) {
  const select = useProjectStore((state) => state.select);
  const moveEdge = useProjectStore((state) => state.moveEdge);
  const deleteEdges = useProjectStore((state) => state.deleteEdges);
  if (edges.length === 0) return null;
  return (
    <ul className="sp-trans-list">
      {edges.map((edge, index) => {
        const other = graph.nodes.find((item) => item.id === edge[side]);
        const otherTitle = other ? beatLabel(other, project) : "Missing beat";
        const logic = transitionLogic(edge, project);
        return (
          <li
            key={edge.id}
            onContextMenu={menuHandler(() => [
              ...(addItems ? [...addItems(), "separator" as const] : []),
              {
                label: "Rename",
                onSelect: () => {
                  select({ kind: "edge", id: edge.id });
                  focusRename(edge.id);
                },
              },
              { label: "Delete", danger: true, onSelect: () => deleteEdges([edge.id]) },
            ])}
          >
            <button type="button" className="sp-trans" onClick={() => select({ kind: "edge", id: edge.id })}>
              <span className="sp-trans-top">
                <strong>{edge.label || (side === "target" ? `→ ${otherTitle}` : `${otherTitle} →`)}</strong>
                {edge.label && <span className="sp-faint">{side === "target" ? `→ ${otherTitle}` : `from ${otherTitle}`}</span>}
              </span>
              {logic && <span className="sp-trans-logic">{logic}</span>}
            </button>
            {reorder && (
              <span className="sp-trans-order">
                <IconButton label="Move up" disabled={index === 0} onClick={() => moveEdge(edge.id, -1)}>
                  ↑
                </IconButton>
                <IconButton label="Move down" disabled={index === edges.length - 1} onClick={() => moveEdge(edge.id, 1)}>
                  ↓
                </IconButton>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Inherited({ ids, project, from }: { ids: string[]; project: ProjectDocument; from: string }) {
  if (ids.length === 0) return null;
  return (
    <p className="sp-node-refs">
      {ids.map((id) => (
        <span key={id} className="sp-ref is-inherited" title={from}>
          {entityName(project, id)}
        </span>
      ))}
    </p>
  );
}

function EntityChips({
  project,
  names,
  selected,
  onChange,
}: {
  project: ProjectDocument;
  names: StoryEntity[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const known = new Set(names.map((entity) => entity.id));
  const missing = selected.filter((id) => !known.has(id));
  if (names.length === 0 && missing.length === 0) return null;
  return (
    <div className="sp-loc-picks">
      {missing.map((id) => (
        <button
          key={id}
          type="button"
          className="sp-chip-btn is-on is-missing"
          aria-label="Delete missing reference"
          onClick={() => onChange(selected.filter((item) => item !== id))}
        >
          missing ×
        </button>
      ))}
      {names.map((entity) => {
        const on = selected.includes(entity.id);
        return (
          <button
            key={entity.id}
            type="button"
            className={on ? "sp-chip-btn is-on" : "sp-chip-btn"}
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((id) => id !== entity.id) : [...selected, entity.id])}
          >
            {entityLabel(project, entity)}
          </button>
        );
      })}
    </div>
  );
}

function transitionLogic(edge: StoryEdge, project: ProjectDocument): string {
  return edge.condition ? `if ${describeCondition(edge.condition, project)}` : "";
}

function EdgeInspector({ graph, edgeId }: { graph: GraphDocument; edgeId: string }) {
  const project = useProjectStore((state) => state.project);
  const updateEdge = useProjectStore((state) => state.updateEdge);
  const deleteEdges = useProjectStore((state) => state.deleteEdges);
  const edge = graph.edges.find((item) => item.id === edgeId);
  const [refused, setRefused] = useState<"source" | "target" | null>(null);
  if (!edge || !project) return null;
  /** A self-loop, or a pair that already has a transition, is refused and the select is marked. */
  const change = (side: "source" | "target", value: string) => {
    const source = side === "source" ? value : edge.source;
    const target = side === "target" ? value : edge.target;
    const taken = graph.edges.some((item) => item.id !== edge.id && item.source === source && item.target === target);
    if (source === target || taken) {
      setRefused(side);
      return;
    }
    setRefused(null);
    updateEdge(edge.id, { [side]: value });
  };

  return (
    <>
      <div className="sp-insp-head">
        <span className="sp-kicker">Transition</span>
        <input
          className="sp-head-input"
          aria-label="Transition label"
          data-rename={edge.id}
          placeholder="Label"
          value={edge.label}
          onChange={(event) => updateEdge(edge.id, { label: event.target.value })}
        />
      </div>
      <Row label="From">
        <span className="sp-row-pair">
          <select
            className={refused === "source" ? "sp-cell is-dup" : "sp-cell"}
            aria-label="From beat"
            aria-invalid={refused === "source" || undefined}
            value={edge.source}
            onChange={(event) => change("source", event.target.value)}
          >
            {graph.nodes
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {shortBeatLabel(item, project)}
                </option>
              ))}
          </select>
        </span>
      </Row>
      <Row label="To">
        <span className="sp-row-pair">
          <select
            className={refused === "target" ? "sp-cell is-dup" : "sp-cell"}
            aria-label="To beat"
            aria-invalid={refused === "target" || undefined}
            value={edge.target}
            onChange={(event) => change("target", event.target.value)}
          >
            {graph.nodes.map((item) => (
                <option key={item.id} value={item.id}>
                  {shortBeatLabel(item, project)}
                </option>
              ))}
          </select>
        </span>
      </Row>
      <Section
        id="insp:conditions"
        title="Conditions"
        summary={describeCondition(edge.condition, project)}
        onContextMenu={menuHandler(() =>
          conditionAddItems(edge.condition, project.variables.length > 0, (condition) => updateEdge(edge.id, { condition })),
        )}
      >
        <ConditionBuilder value={edge.condition} onChange={(condition) => updateEdge(edge.id, { condition })} />
      </Section>
      <span className="sp-insp-pin">
        <IconButton label="Delete transition" danger onClick={() => deleteEdges([edge.id])}>
          ×
        </IconButton>
      </span>
    </>
  );
}
