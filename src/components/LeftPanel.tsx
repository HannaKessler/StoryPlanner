import { beatLabel } from "../domain/labels";
import { useProjectStore, type Screen } from "../store/projectStore";
import { menuHandler } from "./ContextMenu";
import { addBeatItems, beatItems } from "./menuItems";
import { Section } from "./Panel";
import { VariablesPanel } from "./VariablesPanel";

export function LeftPanel() {
  return (
    <aside className="sp-left sp-panel">
      <BeatsOutline />
      <VariablesPanel />
      <LibraryLinks />
    </aside>
  );
}

function LibraryLinks() {
  const project = useProjectStore((state) => state.project);
  const screen = useProjectStore((state) => state.screen);
  const setScreen = useProjectStore((state) => state.setScreen);
  if (!project) return null;
  const links: Array<[Screen, string, number]> = [
    ["characters", "Characters", project.characters.length],
    ["items", "Items", project.items.length],
    ["locations", "Locations", project.locations.length],
  ];
  return (
    <nav className="sp-library-links" aria-label="Libraries">
      {links.map(([id, label, count]) => (
        <button key={id} type="button" className={screen === id ? "is-active" : ""} onClick={() => setScreen(id)}>
          <span>{label}</span>
          <span className="sp-sec-count">{count}</span>
        </button>
      ))}
    </nav>
  );
}

function BeatsOutline() {
  const project = useProjectStore((state) => state.project);
  const graph = useProjectStore((state) => (state.currentGraphId ? state.graphs[state.currentGraphId] : null));
  const selection = useProjectStore((state) => state.selection);
  const select = useProjectStore((state) => state.select);
  if (!graph) return null;
  return (
    <Section id="left:beats" title="Beats" count={graph.nodes.length} summary={graph.name} onContextMenu={menuHandler(() => addBeatItems())}>
      <ul className="sp-beats">
        {graph.nodes.map((node) => {
          const active = selection?.kind === "node" && selection.id === node.id;
          return (
            <li
              key={node.id}
              className={active ? "is-active" : ""}
              onContextMenu={menuHandler(() => beatItems(node))}
            >
              <button type="button" className="sp-beat" onClick={() => select({ kind: "node", id: node.id })}>
                <span className="sp-beat-title">{beatLabel(node, project)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
