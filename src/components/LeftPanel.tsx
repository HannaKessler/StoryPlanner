import { useProjectStore } from "../store/projectStore";
import { Section } from "./Panel";
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
  if (!graph) return null;
  return (
    <Section id="left:beats" title="Beats" count={graph.nodes.length} summary={graph.name}>
      <ul className="sp-beats">
        {graph.nodes.map((node) => {
          const active = selection?.kind === "node" && selection.id === node.id;
          return (
            <li key={node.id} className={active ? "is-active" : ""}>
              <button type="button" className="sp-beat" onClick={() => select({ kind: "node", id: node.id })}>
                <span className="sp-beat-title">{node.title || "Untitled"}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
