import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";
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
        <Logo size={42} />
        <p className="sp-kicker">StoryPlanner</p>
        <h1>Plan the story before the script.</h1>
        <p className="sp-lede">
          Start with the big events, open any beat into its own graph, and keep going until you reach the line
          someone actually says. Variables, tags, and choices stay with the project.
        </p>
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
          <p className="sp-muted">
            Projects are folders. <code>project.json</code> holds variables and tags. Each graph, including nested
            ones, is a file under <code>graphs/</code>.
          </p>
        ) : (
          <ul className="sp-recent">
            {recents.map((recent) => (
              <li key={recent.path}>
                <button type="button" disabled={busy} onClick={() => void openAt(recent.path)}>
                  <strong>{recent.name}</strong>
                  <span>{recent.path}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="sp-muted sp-aside-note">
          The sample, The Lantern Gate, has a nested dialogue graph, compound conditions, and a cast you can play
          through.
        </p>
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
      <Field label="Project name">
        <input className="sp-input" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
      </Field>
      <p className="sp-muted">Next you’ll pick a parent folder. StoryPlanner creates a project folder inside it.</p>
      {banner?.tone === "error" && <p className="sp-banner is-error">{banner.text}</p>}
      <div className="sp-modal-actions">
        <button type="button" className="sp-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="sp-btn is-primary" disabled={busy || !name.trim()} onClick={() => void onCreate(name)}>
          Choose folder
        </button>
      </div>
    </Modal>
  );
}
