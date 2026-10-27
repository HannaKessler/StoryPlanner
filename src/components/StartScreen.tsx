import { useEffect, useRef, useState } from "react";
import { Field, Modal } from "./Modal";
import { useProjectStore } from "../store/projectStore";

export function StartScreen() {
  const recents = useProjectStore((state) => state.recents);
  const banner = useProjectStore((state) => state.banner);
  const busy = useProjectStore((state) => state.busy);
  const resumeIntent = useProjectStore((state) => state.resumeIntent);
  const openAt = useProjectStore((state) => state.openAt);
  const openFromDialog = useProjectStore((state) => state.openFromDialog);
  const openSample = useProjectStore((state) => state.openSample);
  const createNamedProject = useProjectStore((state) => state.createNamedProject);
  const dismissBanner = useProjectStore((state) => state.dismissBanner);
  const [creating, setCreating] = useState(false);
  const handledIntent = useRef<string | null>(null);

  useEffect(() => {
    if (!resumeIntent || handledIntent.current === resumeIntent) return;
    handledIntent.current = resumeIntent;
    useProjectStore.setState({ resumeIntent: null });
    if (resumeIntent === "new") setCreating(true);
    if (resumeIntent === "open") void openFromDialog();
  }, [resumeIntent, openFromDialog]);

  return (
    <div className="sp-start">
      <section className="sp-start-hero">
        <h1>StoryPlanner</h1>
        <div className="sp-start-actions">
          <button type="button" className="sp-btn is-primary" disabled={busy} onClick={() => setCreating(true)}>
            New project
          </button>
          <button type="button" className="sp-btn" disabled={busy} onClick={() => void openFromDialog()}>
            Open project
          </button>
          <button type="button" className="sp-btn" disabled={busy} onClick={() => void openSample()}>
            Open sample
          </button>
        </div>
        {banner && (
          <p className={banner.tone === "error" ? "sp-banner is-error" : "sp-banner"} role="status">
            {banner.text}
            <button type="button" onClick={dismissBanner} aria-label="Dismiss">
              ×
            </button>
          </p>
        )}
      </section>
      <aside className="sp-start-aside">
        <h2>Recent</h2>
        {recents.length === 0 ? (
          <p className="sp-faint">None</p>
        ) : (
          <ul className="sp-recent">
            {recents.map((recent) => (
              <li key={recent.path}>
                <button type="button" disabled={busy} title={recent.path} onClick={() => void openAt(recent.path)}>
                  <strong>{recent.name}</strong>
                  <span>{recent.path}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      {creating && (
        <NewProjectDialog
          onClose={() => setCreating(false)}
          onCreate={async (name) => {
            await createNamedProject(name);
            if (useProjectStore.getState().project) setCreating(false);
          }}
        />
      )}
    </div>
  );
}

export function NewProjectDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("Untitled story");
  const busy = useProjectStore((state) => state.busy);
  const banner = useProjectStore((state) => state.banner);
  return (
    <Modal title="New project" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && name.trim()) void onCreate(name);
        }}
      >
      <Field label="Project name">
        <input className="sp-input" value={name} onChange={(event) => setName(event.target.value)} autoFocus onFocus={(event) => event.target.select()} />
      </Field>
      {banner?.tone === "error" && <p className="sp-banner is-error">{banner.text}</p>}
      <div className="sp-modal-actions">
        <button type="button" className="sp-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="sp-btn is-primary" disabled={busy || !name.trim()}>
          Choose folder…
        </button>
      </div>
      </form>
    </Modal>
  );
}
