import { useState } from "react";
import { graphBreadcrumbs } from "../domain/graphOps";
import { NODE_LABEL } from "../domain/labels";
import type { StoryNodeType } from "../domain/types";
import { SCHEMA_VERSION } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { ExportDialog } from "./ExportDialog";
import { GraphCanvas } from "./GraphCanvas";
import { Inspector } from "./Inspector";
import { Logo } from "./Logo";
import { Modal } from "./Modal";
import { PlayMode } from "./PlayMode";
import { TagsManager } from "./TagsManager";
import { VariablesManager } from "./VariablesManager";

const ADDABLE: StoryNodeType[] = ["event", "scene", "dialogue", "end"];

export function AppShell() {
  const project = useProjectStore((state) => state.project);
  const graphs = useProjectStore((state) => state.graphs);
  const currentGraphId = useProjectStore((state) => state.currentGraphId);
  const screen = useProjectStore((state) => state.screen);
  const dirty = useProjectStore((state) => state.dirty);
  const path = useProjectStore((state) => state.projectPath);
  const banner = useProjectStore((state) => state.banner);
  const pendingClose = useProjectStore((state) => state.pendingClose);
  const exportOpen = useProjectStore((state) => state.exportOpen);
  const busy = useProjectStore((state) => state.busy);
  const setScreen = useProjectStore((state) => state.setScreen);
  const renameProject = useProjectStore((state) => state.renameProject);
  const openGraph = useProjectStore((state) => state.openGraph);
  const addNode = useProjectStore((state) => state.addNode);
  const save = useProjectStore((state) => state.save);
  const requestClose = useProjectStore((state) => state.requestClose);
  const setExportOpen = useProjectStore((state) => state.setExportOpen);
  const dismissBanner = useProjectStore((state) => state.dismissBanner);
  const [menu, setMenu] = useState(false);

  if (!project || !currentGraphId) return null;
  const graph = graphs[currentGraphId];
  const crumbs = graphBreadcrumbs(graphs, currentGraphId);
  const hasStart = graph?.nodes.some((node) => node.type === "start");

  return (
    <div className="sp-app">
      <header className="sp-topbar">
        <div className="sp-brand">
          <Logo size={26} />
          <div className="sp-menu">
            <button type="button" className="sp-btn sp-btn-quiet" onClick={() => setMenu((open) => !open)}>
              File
            </button>
            {menu && (
              <>
                <button type="button" className="sp-menu-back" aria-label="Close menu" onClick={() => setMenu(false)} />
                <div className="sp-menu-pop" role="menu">
                  <button type="button" onClick={() => { setMenu(false); requestClose("new"); }}>
                    New project
                  </button>
                  <button type="button" onClick={() => { setMenu(false); requestClose("open"); }}>
                    Open project
                  </button>
                  <button type="button" onClick={() => { setMenu(false); void save(); }}>
                    Save <kbd>Ctrl+S</kbd>
                  </button>
                  <button type="button" onClick={() => { setMenu(false); setExportOpen(true); }}>
                    Export…
                  </button>
                  <button type="button" onClick={() => { setMenu(false); requestClose(null); }}>
                    Close project
                  </button>
                </div>
              </>
            )}
          </div>
          <input
            className="sp-title-input"
            aria-label="Project name"
            value={project.name}
            onChange={(event) => renameProject(event.target.value)}
          />
          {dirty && <span className="sp-dirty">Unsaved</span>}
        </div>
        <nav className="sp-modes" aria-label="Sections">
          {(
            [
              ["graph", "Graph"],
              ["play", "Play"],
              ["variables", "Variables"],
              ["tags", "Tags"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={screen === id ? "is-active" : ""}
              onClick={() => setScreen(id)}
            >
              {label}
            </button>
          ))}
          <button type="button" onClick={() => setExportOpen(true)}>
            Export
          </button>
        </nav>
      </header>
      <div className="sp-main">
        {banner && (
          <div className={banner.tone === "error" ? "sp-banner is-error" : "sp-banner"} role="status">
            <span>{banner.text}</span>
            <button type="button" onClick={dismissBanner} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}
        {screen === "graph" && graph && (
          <>
            <div className="sp-crumbs">
              <nav aria-label="Graph path">
                {crumbs.map((crumb, index) => (
                  <span key={crumb.id}>
                    {index > 0 && <span className="sp-crumb-sep">/</span>}
                    <button type="button" onClick={() => openGraph(crumb.id)} disabled={crumb.id === currentGraphId}>
                      {crumb.name}
                    </button>
                  </span>
                ))}
              </nav>
              <div className="sp-toolbar">
                {!hasStart && (
                  <button type="button" className="sp-btn sp-btn-small" onClick={() => addNode("start")}>
                    + Start
                  </button>
                )}
                {ADDABLE.map((type) => (
                  <button key={type} type="button" className={`sp-btn sp-btn-small sp-type-${type}`} onClick={() => addNode(type)}>
                    + {NODE_LABEL[type]}
                  </button>
                ))}
              </div>
            </div>
            <div className="sp-workspace">
              <aside className="sp-outline">
                <h2>This graph</h2>
                <ul>
                  {graph.nodes.map((node) => (
                    <li key={node.id}>
                      <button
                        type="button"
                        className="sp-outline-item"
                        onClick={() => useProjectStore.getState().select({ kind: "node", id: node.id })}
                      >
                        <i className={`sp-dot sp-type-${node.type}`} />
                        <span>
                          <small>{NODE_LABEL[node.type]}</small>
                          {node.title || "Untitled"}
                        </span>
                      </button>
                      {node.subgraphId && (
                        <button type="button" className="sp-icon-btn" aria-label="Open inner graph" onClick={() => openGraph(node.subgraphId!)}>
                          ↳
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </aside>
              <GraphCanvas />
              <Inspector />
            </div>
          </>
        )}
        {screen === "play" && <PlayMode />}
        {screen === "variables" && <VariablesManager />}
        {screen === "tags" && <TagsManager />}
      </div>
      <footer className="sp-status">
        <span className="sp-status-path">{path}</span>
        <span>
          {graph ? `${graph.nodes.length} beats` : ""} · schema v{SCHEMA_VERSION}
          {dirty ? " · unsaved" : " · saved"}
        </span>
      </footer>
      {exportOpen && <ExportDialog />}
      {pendingClose && (
        <Modal title="Unsaved changes" onClose={() => useProjectStore.getState().cancelClose()}>
          <p>Save this project before closing it?</p>
          <div className="sp-modal-actions">
            <button type="button" className="sp-btn" onClick={() => useProjectStore.getState().cancelClose()}>
              Cancel
            </button>
            <button type="button" className="sp-btn" onClick={() => useProjectStore.getState().discardAndClose()}>
              Discard
            </button>
            <button type="button" className="sp-btn is-primary" disabled={busy} onClick={() => void useProjectStore.getState().saveAndClose()}>
              Save and close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
