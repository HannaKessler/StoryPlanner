import { graphBreadcrumbs } from "../domain/graphOps";
import { plural } from "../domain/labels";
import { libraryKind } from "../domain/format";
import { useProjectStore } from "../store/projectStore";
import { EntityEditor } from "./EntityEditor";
import { ExportDialog } from "./ExportDialog";
import { GraphCanvas } from "./GraphCanvas";
import { Inspector } from "./Inspector";
import { LeftPanel } from "./LeftPanel";
import { openMenuBelow, type MenuItem } from "./ContextMenu";
import { Modal } from "./Modal";
import { PlayMode } from "./PlayMode";
import { WriteMode } from "./WriteMode";

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
  const resumeIntent = useProjectStore((state) => state.resumeIntent);
  const renameProject = useProjectStore((state) => state.renameProject);
  const openGraph = useProjectStore((state) => state.openGraph);
  const dismissBanner = useProjectStore((state) => state.dismissBanner);
  const canUndo = useProjectStore((state) => state.past.length > 0);
  const canRedo = useProjectStore((state) => state.future.length > 0);
  const confirm = useProjectStore((state) => state.confirm);
  const editMode = useProjectStore((state) => state.editMode);
  const panels = useProjectStore((state) => state.panels);
  const setEditMode = useProjectStore((state) => state.setEditMode);
  const togglePanel = useProjectStore((state) => state.togglePanel);
  const writing = screen === "graph" && editMode === "write";

  if (!project || !currentGraphId) return null;
  const graph = graphs[currentGraphId];
  const crumbs = graphBreadcrumbs(graphs, currentGraphId, project);

  return (
    <div className="sp-app">
      <header className="sp-topbar">
        <div className="sp-brand">
          <button
            type="button"
            className="sp-btn sp-btn-quiet"
            aria-haspopup="menu"
            onClick={(event) => openMenuBelow(event.currentTarget, fileItems(canUndo, canRedo))}
          >
            File
          </button>
          <input
            className="sp-title-input"
            aria-label="Project name"
            value={project.name}
            onChange={(event) => renameProject(event.target.value)}
          />
          {dirty && <span className="sp-dirty">Unsaved</span>}
        </div>
        <nav className="sp-editmode" aria-label="Views">
          {(
            [
              ["structure", "Structure"],
              ["write", "Write"],
              ["characters", "Characters"],
              ["items", "Items"],
              ["locations", "Locations"],
            ] as const
          ).map(([id, label]) => {
            const mode = id === "structure" || id === "write";
            const on = mode ? screen === "graph" && editMode === id : screen === id;
            return (
              <button
                key={id}
                type="button"
                className={on ? "is-active" : ""}
                aria-current={on ? "page" : undefined}
                onClick={() => (mode ? setEditMode(id) : useProjectStore.getState().setScreen(id))}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </header>
      <div className="sp-main">
        {banner && (
          <div className={banner.tone === "error" ? "sp-banner is-error" : "sp-banner"} role={banner.tone === "error" ? "alert" : "status"}>
            <span>{banner.text}</span>
            <button type="button" onClick={dismissBanner} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}
        {screen === "graph" && graph && (
          <>
            {(crumbs.length > 1 || !writing) && (
              <div className="sp-crumbs">
                {crumbs.length > 1 ? (
              <nav aria-label="Graph path">
                {crumbs.map((crumb, index) => (
                  <span key={crumb.id}>
                    {index > 0 && <span className="sp-crumb-sep">/</span>}
                    <button
                      type="button"
                      onClick={() => openGraph(crumb.id)}
                      disabled={crumb.id === currentGraphId}
                      aria-current={crumb.id === currentGraphId ? "location" : undefined}
                    >
                      {crumb.name}
                    </button>
                  </span>
                ))}
              </nav>
                ) : (
                  <span />
                )}
              <div className="sp-toolbar">
                {!writing && (
                  <>
                    <button type="button" className={panels.left ? "sp-chip-btn is-on" : "sp-chip-btn"} aria-pressed={panels.left} onClick={() => togglePanel("left")}>
                      Outline
                    </button>
                    <button type="button" className={panels.right ? "sp-chip-btn is-on" : "sp-chip-btn"} aria-pressed={panels.right} onClick={() => togglePanel("right")}>
                      Inspector
                    </button>
                  </>
                )}
              </div>
            </div>
            )}
            {writing ? (
              <div className="sp-workspace is-write">
                <LeftPanel outlineOnly />
                <WriteMode />
              </div>
            ) : (
              <div className={`sp-workspace${panels.left ? "" : " no-left"}${panels.right ? "" : " no-right"}`}>
                {panels.left && <LeftPanel />}
                <GraphCanvas />
                {panels.right && <Inspector />}
              </div>
            )}
          </>
        )}
        {/* Play mode is hidden for now. Nothing switches to it, but it stays easy to bring back. */}
        {screen === "play" && <PlayMode />}
        {(screen === "characters" || screen === "items" || screen === "locations") && (
          <div className="sp-workspace">
            <LeftPanel />
            <EntityEditor kind={libraryKind(screen)} />
          </div>
        )}
      </div>
      <footer className="sp-status">
        <span className="sp-status-path">{path}</span>
        <span>
          {graph && (
            <>
              {`${plural(graph.nodes.length, "event")} · ${plural(graph.edges.length, "transition")} (${graph.edges.filter((edge) => edge.condition).length} conditional)`}
              {" · "}
            </>
          )}
          {plural(project.variables.length, "variable")}
        </span>
      </footer>
      {exportOpen && <ExportDialog />}
      {confirm && (
        <Modal title={confirm.title} onClose={() => useProjectStore.getState().resolveConfirm(false)}>
          <p className="sp-modal-text">{confirm.message}</p>
          <div className="sp-modal-actions">
            <button type="button" className="sp-btn" onClick={() => useProjectStore.getState().resolveConfirm(false)}>
              Cancel
            </button>
            <button type="button" className="sp-btn is-danger" autoFocus onClick={() => useProjectStore.getState().resolveConfirm(true)}>
              {confirm.confirmLabel}
            </button>
          </div>
        </Modal>
      )}
      {pendingClose && (
        <Modal title="Unsaved changes" onClose={() => useProjectStore.getState().cancelClose()}>
          <div className="sp-modal-actions">
            <button type="button" className="sp-btn" onClick={() => useProjectStore.getState().cancelClose()}>
              Cancel
            </button>
            <button type="button" className="sp-btn is-danger" onClick={() => useProjectStore.getState().discardAndClose()}>
              Discard
            </button>
            <button type="button" className="sp-btn is-primary" disabled={busy} onClick={() => void useProjectStore.getState().saveAndClose()}>
              {resumeIntent === "new" || resumeIntent === "open" ? "Save and continue" : "Save and close"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function fileItems(canUndo: boolean, canRedo: boolean): MenuItem[] {
  const state = useProjectStore.getState();
  return [
    { label: "New project", onSelect: () => state.requestClose("new") },
    { label: "Open project", onSelect: () => state.requestClose("open") },
    "separator",
    { label: "Save", hint: "Ctrl+S", onSelect: () => void state.save() },
    { label: "Save as…", hint: "Ctrl+Shift+S", onSelect: () => void state.saveAs() },
    { label: "Undo", hint: "Ctrl+Z", disabled: !canUndo, onSelect: () => state.undo() },
    { label: "Redo", hint: "Ctrl+Y", disabled: !canRedo, onSelect: () => state.redo() },
    "separator",
    { label: "Export…", hint: "Ctrl+E", onSelect: () => state.setExportOpen(true) },
    { label: "Close project", onSelect: () => state.requestClose(null) },
  ];
}
