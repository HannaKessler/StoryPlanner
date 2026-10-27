import { useEffect } from "react";
import { inTauri, setWindowTitle } from "./desktop/tauri";
import { AppShell } from "./components/AppShell";
import { ContextMenu } from "./components/ContextMenu";
import { StartScreen } from "./components/StartScreen";
import { useProjectStore } from "./store/projectStore";

export function App() {
  const project = useProjectStore((state) => state.project);
  const init = useProjectStore((state) => state.init);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    void setWindowTitle(project ? `StoryPlanner — ${project.name}` : "StoryPlanner");
  }, [project?.name]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = useProjectStore.getState();
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
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
