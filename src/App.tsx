import { useEffect } from "react";
import { inTauri, onWindowCloseRequested, setWindowTitle } from "./desktop/tauri";
import { AppShell } from "./components/AppShell";
import { ContextMenu, focusRename, useContextMenu } from "./components/ContextMenu";
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
        if (document.querySelector(".sp-modal")) return;
        if (editingText(event.target)) {
          (event.target as HTMLElement).blur();
          return;
        }
        // A page in Write mode always shows a beat.
        if (state.selection && !(state.screen === "graph" && state.editMode === "write")) state.select(null);
        return;
      }
      if (mod && key === "s") {
        event.preventDefault();
        if (state.project) void (event.shiftKey ? state.saveAs() : state.save());
        return;
      }
      // Reloading the window would drop unsaved work.
      if (inTauri() && state.dirty && (key === "f5" || (mod && key === "r"))) {
        event.preventDefault();
        return;
      }
      // Typing in a field, or a dialog or menu being open, leaves the shortcuts below alone.
      const typing = editingText(event.target) || Boolean(document.querySelector(".sp-modal, .sp-context"));
      if (state.project && !typing && !mod && !event.altKey && key === "f2" && state.selection && state.screen === "graph") {
        event.preventDefault();
        focusRename(state.selection.id);
        return;
      }
      if (state.project && !typing && mod && !event.altKey && key === "d" && state.selection?.kind === "node" && state.screen === "graph") {
        event.preventDefault();
        state.duplicateNode(state.selection.id);
        return;
      }
      const modal = Boolean(document.querySelector(".sp-modal, .sp-context"));
      if (state.project && !modal && mod && !event.altKey && !event.shiftKey && (key === "1" || key === "2")) {
        event.preventDefault();
        state.setEditMode(key === "1" ? "structure" : "write");
        return;
      }
      // Tab switches mode unless a field or button has focus, where it keeps moving focus.
      if (state.project && !typing && !mod && !event.altKey && !event.shiftKey && key === "tab" && state.screen === "graph" && !focusMoves(event.target)) {
        event.preventDefault();
        state.setEditMode(state.editMode === "write" ? "structure" : "write");
        return;
      }
      if (state.project && !modal && mod && !event.altKey && !event.shiftKey && (key === "arrowdown" || key === "arrowup") && state.screen === "graph") {
        event.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur?.();
        state.stepBeat(key === "arrowdown" ? 1 : -1);
        return;
      }
      if (!mod || event.altKey || !state.project || typing) return;
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

/** Controls where Tab should keep its usual meaning. */
function focusMoves(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("button, a[href], summary, .sp-modal, .sp-context"));
}
