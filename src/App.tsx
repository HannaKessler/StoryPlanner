import { useEffect } from "react";
import { setWindowTitle } from "./desktop/tauri";
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
  }, [project]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        const state = useProjectStore.getState();
        if (state.project) void state.save();
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
