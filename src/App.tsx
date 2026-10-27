import { useEffect } from "react";
import { inTauri, onWindowCloseRequested, setWindowTitle } from "./desktop/tauri";
import { AppShell } from "./components/AppShell";
import { ContextMenu, useContextMenu } from "./components/ContextMenu";
import { StartScreen } from "./components/StartScreen";
import { useProjectStore } from "./store/projectStore";

export function App() {
  const project = useProjectStore((state) => state.project);
  const init = useProjectStore((state) => state.init);
  const dirty = useProjectStore((state) => state.dirty);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    void setWindowTitle(project ? `StoryPlanner — ${dirty ? "• " : ""}${project.name}` : "StoryPlanner");
  }, [project?.name, dirty]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = useProjectStore.getState();
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (key === "escape") {
        // Menus and dialogs close themselves. Otherwise Escape leaves a text field, then clears the selection.
        if (useContextMenu.getState().menu || state.confirm || state.pendingClose || state.exportOpen) return;
        if (document.querySelector(".sp-menu-pop, .sp-modal")) return;
        if (editingText(event.target)) {
          (event.target as HTMLElement).blur();
          return;
        }
        if (state.selection) state.select(null);
        return;
      }
      if (mod && key === "s") {
        event.preventDefault();
        if (state.project) void state.save();
        return;
      }
      // Reloading the window would drop unsaved work.
      if (inTauri() && state.dirty && (key === "f5" || (mod && key === "r"))) {
        event.preventDefault();
        return;
      }
      if (!mod || event.altKey || !state.project || editingText(event.target)) return;
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        state.undo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        state.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (inTauri()) {
      // The window close button goes through the unsaved-changes prompt.
      return onWindowCloseRequested(() => {
        const state = useProjectStore.getState();
        if (!state.project || !state.dirty) return false;
        state.requestClose("quit");
        return true;
      });
    }
    const onUnload = (event: BeforeUnloadEvent) => {
      if (!useProjectStore.getState().dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  return (
    <>
      {project ? <AppShell /> : <StartScreen />}
      <ContextMenu />
    </>
  );
}

function editingText(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
