import { NODE_LABEL } from "../domain/labels";
import { useProjectStore } from "../store/projectStore";
import { ConditionBuilder } from "./ConditionBuilder";
import { DialogueEditor } from "./DialogueEditor";
import { EffectsEditor } from "./EffectsEditor";
import { Field } from "./Modal";

export function Inspector() {
  const selection = useProjectStore((state) => state.selection);
  const currentGraphId = useProjectStore((state) => state.currentGraphId);
  const graph = useProjectStore((state) => (state.currentGraphId ? state.graphs[state.currentGraphId] : null));
  if (!graph || !currentGraphId) return null;
  if (selection?.kind === "edge") {
    const edge = graph.edges.find((item) => item.id === selection.id);
    if (edge) return <EdgeInspector edgeId={edge.id} />;
  }
  if (selection?.kind === "node") {
    const node = graph.nodes.find((item) => item.id === selection.id);
    if (node) return <NodeInspector nodeId={node.id} />;
  }
  return <GraphInspector />;
}

function GraphInspector() {
  const graph = useProjectStore((state) => (state.currentGraphId ? state.graphs[state.currentGraphId] : null));
  const updateGraphMeta = useProjectStore((state) => state.updateGraphMeta);
  if (!graph) return null;
  return (
    <aside className="sp-inspector">
      <p className="sp-kicker">Graph</p>
      <Field label="Name">
        <input className="sp-input" value={graph.name} onChange={(event) => updateGraphMeta({ name: event.target.value })} />
      </Field>
      <Field label="Scene notes">
        <textarea
          className="sp-textarea"
          rows={5}
          placeholder="Notes that cover this whole graph."
          value={graph.sceneNotes}
          onChange={(event) => updateGraphMeta({ sceneNotes: event.target.value })}
        />
      </Field>
      <p className="sp-muted">
        Select a beat or a connection. Events, scenes, and dialogue can open into their own graph. There is no depth limit.
      </p>
    </aside>
  );
}

function NodeInspector({ nodeId }: { nodeId: string }) {
  const graph = useProjectStore((state) => (state.currentGraphId ? state.graphs[state.currentGraphId] : null));
  const graphs = useProjectStore((state) => state.graphs);
  const node = graph?.nodes.find((item) => item.id === nodeId);
  const updateNode = useProjectStore((state) => state.updateNode);
  const openSubgraph = useProjectStore((state) => state.openSubgraph);
  const deleteSubgraph = useProjectStore((state) => state.deleteSubgraph);
  const deleteNodes = useProjectStore((state) => state.deleteNodes);
  const addNodeEffect = useProjectStore((state) => state.addNodeEffect);
  const updateNodeEffect = useProjectStore((state) => state.updateNodeEffect);
  const deleteNodeEffect = useProjectStore((state) => state.deleteNodeEffect);
  const addChoice = useProjectStore((state) => state.addChoice);
  const updateChoice = useProjectStore((state) => state.updateChoice);
  const deleteChoice = useProjectStore((state) => state.deleteChoice);
  const moveChoice = useProjectStore((state) => state.moveChoice);
  const addChoiceEffect = useProjectStore((state) => state.addChoiceEffect);
  const updateChoiceEffect = useProjectStore((state) => state.updateChoiceEffect);
  const deleteChoiceEffect = useProjectStore((state) => state.deleteChoiceEffect);
  if (!graph || !node) return null;
  const child = node.subgraphId ? graphs[node.subgraphId] : undefined;
  const showNotes = node.type === "event" || node.type === "scene" || node.type === "dialogue";

  return (
    <aside className="sp-inspector">
      <p className={`sp-kicker sp-type-${node.type}`}>{NODE_LABEL[node.type]}</p>
      <Field label="Title">
        <input className="sp-input" value={node.title} onChange={(event) => updateNode(node.id, { title: event.target.value })} />
      </Field>
      {node.type !== "start" && (
        <Field label="Summary">
          <textarea className="sp-textarea" rows={3} value={node.summary} onChange={(event) => updateNode(node.id, { summary: event.target.value })} />
        </Field>
      )}
      {showNotes && (
        <Field label="Scene notes">
          <textarea
            className="sp-textarea"
            rows={4}
            placeholder="Setting, action, and direction."
            value={node.sceneNotes}
            onChange={(event) => updateNode(node.id, { sceneNotes: event.target.value })}
          />
        </Field>
      )}

      {showNotes && (
        <section>
          <h3>Inner graph</h3>
          <p className="sp-muted">{child ? `Opens “${child.name}”.` : "This beat has no inner graph yet."}</p>
          <div className="sp-inline">
            <button type="button" className="sp-btn sp-btn-small" onClick={() => openSubgraph(node.id)}>
              {child ? "Open" : "Create inner graph"}
            </button>
            {child && (
              <button type="button" className="sp-btn sp-btn-small is-danger" onClick={() => deleteSubgraph(node.id)}>
                Remove inner graph
              </button>
            )}
          </div>
        </section>
      )}

      <section>
        <h3>On enter</h3>
        <EffectsEditor
          effects={node.effects}
          onAdd={() => addNodeEffect(node.id)}
          onUpdate={(effectId, patch) => updateNodeEffect(node.id, effectId, patch)}
          onDelete={(effectId) => deleteNodeEffect(node.id, effectId)}
        />
      </section>

      {node.type === "dialogue" && (
        <section>
          <h3>Dialogue</h3>
          <DialogueEditor nodeId={node.id} lines={node.lines} />
        </section>
      )}

      {node.type === "dialogue" && (
        <section>
          <h3>Choices</h3>
          {node.choices.map((choice, index) => {
            const edge = graph.edges.find((item) => item.choiceId === choice.id);
            const target = edge ? graph.nodes.find((item) => item.id === edge.target) : undefined;
            return (
              <article key={choice.id} className="sp-choice-card">
                <div className="sp-choice-head">
                  <input
                    className="sp-input"
                    value={choice.label}
                    aria-label="Choice label"
                    onChange={(event) => updateChoice(node.id, choice.id, { label: event.target.value })}
                  />
                  <button type="button" className="sp-icon-btn" disabled={index === 0} onClick={() => moveChoice(node.id, choice.id, -1)} aria-label="Move choice up">
                    ↑
                  </button>
                  <button type="button" className="sp-icon-btn" disabled={index === node.choices.length - 1} onClick={() => moveChoice(node.id, choice.id, 1)} aria-label="Move choice down">
                    ↓
                  </button>
                  <button type="button" className="sp-icon-btn" onClick={() => deleteChoice(node.id, choice.id)} aria-label="Delete choice">
                    ×
                  </button>
                </div>
                <p className="sp-muted">{target ? `Connects to ${target.title || "Untitled"}.` : "Drag from this choice’s handle to connect it."}</p>
                <h4>When</h4>
                <ConditionBuilder
                  value={choice.condition}
                  onChange={(condition) => updateChoice(node.id, choice.id, { condition })}
                />
                <h4>Then</h4>
                <EffectsEditor
                  effects={choice.effects}
                  onAdd={() => addChoiceEffect(node.id, choice.id)}
                  onUpdate={(effectId, patch) => updateChoiceEffect(node.id, choice.id, effectId, patch)}
                  onDelete={(effectId) => deleteChoiceEffect(node.id, choice.id, effectId)}
                />
              </article>
            );
          })}
          <button type="button" className="sp-btn sp-btn-small" onClick={() => addChoice(node.id)}>
            + Choice
          </button>
        </section>
      )}

      {node.type !== "start" && (
        <button type="button" className="sp-btn is-danger" onClick={() => deleteNodes([node.id])}>
          Delete beat
        </button>
      )}
    </aside>
  );
}

function EdgeInspector({ edgeId }: { edgeId: string }) {
  const graph = useProjectStore((state) => (state.currentGraphId ? state.graphs[state.currentGraphId] : null));
  const edge = graph?.edges.find((item) => item.id === edgeId);
  const updateEdge = useProjectStore((state) => state.updateEdge);
  const deleteEdges = useProjectStore((state) => state.deleteEdges);
  if (!graph || !edge) return null;
  const source = graph.nodes.find((node) => node.id === edge.source);
  const target = graph.nodes.find((node) => node.id === edge.target);
  const choice = source?.choices.find((item) => item.id === edge.choiceId);

  return (
    <aside className="sp-inspector">
      <p className="sp-kicker">Connection</p>
      <p className="sp-muted">
        {source?.title || "Untitled"} → {target?.title || "Untitled"}
      </p>
      <Field label="Label">
        <input className="sp-input" value={edge.label} onChange={(event) => updateEdge(edge.id, { label: event.target.value })} />
      </Field>
      {choice && (
        <p className="sp-muted">
          This is the branch for the choice “{choice.label}”. The choice’s own condition is edited on the dialogue beat.
        </p>
      )}
      <h3>When this connection is available</h3>
      <ConditionBuilder value={edge.condition} onChange={(condition) => updateEdge(edge.id, { condition })} />
      <button type="button" className="sp-btn is-danger" onClick={() => deleteEdges([edge.id])}>
        Delete connection
      </button>
    </aside>
  );
}
