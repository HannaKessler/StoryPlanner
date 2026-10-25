import { useProjectStore } from "../store/projectStore";
import { focusRename, menuHandler } from "./ContextMenu";
import { addBeatItems } from "./menuItems";
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
  const deleteNodes = useProjectStore((state) => state.deleteNodes);
  if (!graph) return null;
  return (
    <Section id="left:beats" title="Beats" count={graph.nodes.length} summary={graph.name} onContextMenu={menuHandler(() => addBeatItems(graph))}>
      <ul className="sp-beats">
        {graph.nodes.map((node) => {
          const active = selection?.kind === "node" && selection.id === node.id;
          return (
            <li
              key={node.id}
              className={active ? "is-active" : ""}
              onContextMenu={menuHandler(() => [
                ...addBeatItems(graph),
                "separator",
                {
                  label: "Rename",
                  onSelect: () => {
                    select({ kind: "node", id: node.id });
                    focusRename(node.id);
                  },
                },
                ...(node.type === "start" ? [] : [{ label: "Delete", danger: true, onSelect: () => deleteNodes([node.id]) }]),
              ])}
            >
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
