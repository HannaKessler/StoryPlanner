import { describeCondition } from "../domain/conditions";
import { describeEffect } from "../domain/effects";
import { beatLabel, NODE_LABEL } from "../domain/labels";
import type { GraphDocument, ProjectDocument, StoryEdge } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { ConditionBuilder } from "./ConditionBuilder";
import { DialogueEditor } from "./DialogueEditor";
import { EffectsEditor } from "./EffectsEditor";
import { focusRename, menuHandler, type MenuItem } from "./ContextMenu";
import { conditionAddItems } from "./menuItems";
import { IconButton, Row, Section } from "./Panel";

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
  return <aside className="sp-inspector sp-panel">{body}</aside>;
}

function GraphInspector({ graph }: { graph: GraphDocument }) {
  const updateGraphMeta = useProjectStore((state) => state.updateGraphMeta);
  return (
    <>
      <div className="sp-insp-head">
        <span className="sp-kicker">Graph</span>
        <input className="sp-head-input" aria-label="Graph name" value={graph.name} onChange={(event) => updateGraphMeta({ name: event.target.value })} />
      </div>
      <Section id="insp:graph-notes" title="Scene notes" summary={graph.sceneNotes}>
        <textarea
          className="sp-cell sp-area"
          rows={3}
          value={graph.sceneNotes}
          onChange={(event) => updateGraphMeta({ sceneNotes: event.target.value })}
        />
      </Section>
    </>
  );
}

function NodeInspector({ graph, nodeId }: { graph: GraphDocument; nodeId: string }) {
  const project = useProjectStore((state) => state.project);
  const graphs = useProjectStore((state) => state.graphs);
  const updateNode = useProjectStore((state) => state.updateNode);
  const openSubgraph = useProjectStore((state) => state.openSubgraph);
  const deleteSubgraph = useProjectStore((state) => state.deleteSubgraph);
  const deleteNodes = useProjectStore((state) => state.deleteNodes);
  const connectNodes = useProjectStore((state) => state.connectNodes);
  const addLine = useProjectStore((state) => state.addLine);
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node || !project) return null;
  const child = node.subgraphId ? graphs[node.subgraphId] : undefined;
  const content = node.type === "event" || node.type === "scene" || node.type === "dialogue";
  const outgoing = graph.edges.filter((edge) => edge.source === node.id);
  const targets = graph.nodes.filter((item) => item.id !== node.id);
  const locationTags = project.tagCategories.filter((category) => category.isLocations).flatMap((category) => category.tags);
  const addTransitionItems = (): MenuItem[] =>
    targets.length === 0
      ? [{ label: "Add transition", disabled: true, onSelect: () => undefined }]
      : targets.map((item) => ({ label: `Add transition to ${beatLabel(item, project)}`, onSelect: () => connectNodes(node.id, item.id) }));

  return (
    <>
      <div className="sp-insp-head">
        <span className="sp-kicker">{NODE_LABEL[node.type]}</span>
        <input className="sp-head-input" aria-label="Title" placeholder="Title" data-rename={node.id} value={node.title} onChange={(event) => updateNode(node.id, { title: event.target.value })} />
        <IconButton label="Delete beat" danger onClick={() => deleteNodes([node.id])}>
          ×
        </IconButton>
      </div>

      {locationTags.length > 0 && (
        <Section id="insp:location" title="Location">
          <div className="sp-loc-picks">
            {locationTags.map((tag) => {
              const on = node.tagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className={on ? "sp-chip-btn is-on" : "sp-chip-btn"}
                  aria-pressed={on}
                  onClick={() =>
                    updateNode(node.id, {
                      tagIds: on ? node.tagIds.filter((id) => id !== tag.id) : [...node.tagIds, tag.id],
                    })
                  }
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {content && child && (
        <div className="sp-inner-row" title="Sub-graph">
          <span className="sp-inner-name">↳ {child.name.trim() || beatLabel(node, project)}</span>
          <button type="button" className="sp-chip-btn" onClick={() => openSubgraph(node.id)}>
            Open
          </button>
          <IconButton label="Remove sub-graph" danger onClick={() => deleteSubgraph(node.id)}>
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
          {content && (
            <textarea
              className="sp-cell sp-area"
              rows={2}
              aria-label="Scene notes"
              placeholder="Scene notes"
              value={node.sceneNotes}
              onChange={(event) => updateNode(node.id, { sceneNotes: event.target.value })}
            />
          )}
        </Section>

      {node.type === "dialogue" && (
        <Section
          id="insp:lines"
          title="Lines"
          count={node.lines.length}
          onContextMenu={menuHandler(() => [{ label: "Add line", onSelect: () => addLine(node.id) }])}
          actions={
            <button type="button" className="sp-chip-btn" onClick={() => addLine(node.id)}>
              + line
            </button>
          }
        >
          <DialogueEditor nodeId={node.id} lines={node.lines} />
        </Section>
      )}

      {node.type !== "end" && (
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
                    {beatLabel(item, project)}
                  </option>
                ))}
            </select>
          }
        >
          <TransitionList graph={graph} edges={outgoing} project={project} side="target" reorder addItems={addTransitionItems} />
        </Section>
      )}

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

function transitionLogic(edge: StoryEdge, project: ProjectDocument): string {
  const parts: string[] = [];
  if (edge.condition) parts.push(`if ${describeCondition(edge.condition, project)}`);
  if (edge.effects.length) parts.push(edge.effects.map((effect) => describeEffect(effect, project)).join(", "));
  return parts.join(" · ");
}

function EdgeInspector({ graph, edgeId }: { graph: GraphDocument; edgeId: string }) {
  const project = useProjectStore((state) => state.project);
  const updateEdge = useProjectStore((state) => state.updateEdge);
  const deleteEdges = useProjectStore((state) => state.deleteEdges);
  const addEdgeEffect = useProjectStore((state) => state.addEdgeEffect);
  const updateEdgeEffect = useProjectStore((state) => state.updateEdgeEffect);
  const deleteEdgeEffect = useProjectStore((state) => state.deleteEdgeEffect);
  const edge = graph.edges.find((item) => item.id === edgeId);
  if (!edge || !project) return null;

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
        <IconButton label="Delete transition" danger onClick={() => deleteEdges([edge.id])}>
          ×
        </IconButton>
      </div>
      <Row label="From">
        <span className="sp-row-pair">
          <select
            className="sp-cell"
            aria-label="From beat"
            value={edge.source}
            onChange={(event) => event.target.value !== edge.target && updateEdge(edge.id, { source: event.target.value })}
          >
            {graph.nodes
              .filter((item) => item.type !== "end")
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {beatLabel(item, project)}
                </option>
              ))}
          </select>
        </span>
      </Row>
      <Row label="To">
        <span className="sp-row-pair">
          <select
            className="sp-cell"
            aria-label="To beat"
            value={edge.target}
            onChange={(event) => event.target.value !== edge.source && updateEdge(edge.id, { target: event.target.value })}
          >
            {graph.nodes.map((item) => (
                <option key={item.id} value={item.id}>
                  {beatLabel(item, project)}
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
          conditionAddItems(edge.condition, project.variables[0]?.id ?? "", (condition) => updateEdge(edge.id, { condition })),
        )}
      >
        <ConditionBuilder value={edge.condition} onChange={(condition) => updateEdge(edge.id, { condition })} />
      </Section>
      <Section
        id="insp:effects"
        title="Effects"
        onContextMenu={menuHandler(() => [
          { label: "Add effect", disabled: project.variables.length === 0, onSelect: () => addEdgeEffect(edge.id) },
        ])}
        count={edge.effects.length}
        summary={edge.effects.map((effect) => describeEffect(effect, project)).join(", ")}
        actions={
          <button
            type="button"
            className="sp-chip-btn"
            disabled={project.variables.length === 0}
            title={project.variables.length === 0 ? "Add a variable first" : undefined}
            onClick={() => addEdgeEffect(edge.id)}
          >
            + effect
          </button>
        }
      >
        <EffectsEditor
          effects={edge.effects}
          onAdd={() => addEdgeEffect(edge.id)}
          onUpdate={(effectId, patch) => updateEdgeEffect(edge.id, effectId, patch)}
          onDelete={(effectId) => deleteEdgeEffect(edge.id, effectId)}
        />
      </Section>
    </>
  );
}
