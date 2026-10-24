import { NODE_LABEL } from "../domain/labels";
import { useProjectStore } from "../store/projectStore";
import { IconButton, Section } from "./Panel";
import { TagsPanel } from "./TagsPanel";
import { VariablesPanel } from "./VariablesPanel";

export function LeftPanel() {
  return (
    <aside className="sp-left sp-panel">
      <BeatsOutline />
      <VariablesPanel />
      <TagsPanel />
    </aside>
  );
}

function BeatsOutline() {
  const graph = useProjectStore((state) => (state.currentGraphId ? state.graphs[state.currentGraphId] : null));
  const selection = useProjectStore((state) => state.selection);
  const select = useProjectStore((state) => state.select);
  const openGraph = useProjectStore((state) => state.openGraph);
  if (!graph) return null;
  return (
    <Section id="left:beats" title="Beats" count={graph.nodes.length} summary={graph.name}>
      <ul className="sp-beats">
        {graph.nodes.map((node) => {
          const outgoing = graph.edges.filter((edge) => edge.source === node.id).length;
          const active = selection?.kind === "node" && selection.id === node.id;
          return (
            <li key={node.id} className={active ? "is-active" : ""}>
              <button type="button" className="sp-beat" onClick={() => select({ kind: "node", id: node.id })}>
                <i className={`sp-dot sp-type-${node.type}`} title={NODE_LABEL[node.type]} />
                <span className="sp-beat-title">{node.title || "Untitled"}</span>
                {outgoing > 0 && <span className="sp-faint" title="Outgoing transitions">→{outgoing}</span>}
              </button>
              {node.subgraphId && (
                <IconButton label="Open inner graph" onClick={() => openGraph(node.subgraphId!)}>
                  ↳
                </IconButton>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
