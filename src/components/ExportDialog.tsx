import { useEffect, useMemo, useState } from "react";
import { bundleProject, slugify } from "../domain/project";
import { stringifyDoc } from "../domain/schema";
import { exportScreenplay } from "../domain/screenplay";
import { exportVoiceSheets } from "../domain/voices";
import { useProjectStore, type ExportKind } from "../store/projectStore";
import { Modal } from "./Modal";

const OPTIONS: Array<{ id: ExportKind; title: string }> = [
  { id: "bundle", title: "Bundled JSON" },
  { id: "screenplay", title: "Full screenplay" },
  { id: "voices", title: "Voice actor sheets" },
];

export function ExportDialog() {
  const project = useProjectStore((state) => state.project);
  const graphs = useProjectStore((state) => state.graphs);
  const setExportOpen = useProjectStore((state) => state.setExportOpen);
  const exportToFile = useProjectStore((state) => state.exportToFile);
  const busy = useProjectStore((state) => state.busy);
  const [kind, setKind] = useState<ExportKind>("bundle");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<{ path: string; at: number } | null>(null);
  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(null), 4000);
    return () => window.clearTimeout(timer);
  }, [saved]);
  const text = useMemo(() => {
    if (!project) return "";
    if (kind === "bundle") return stringifyDoc(bundleProject(project, graphs, new Date().toISOString()));
    if (kind === "screenplay") return exportScreenplay(project, graphs);
    return exportVoiceSheets(project, graphs);
  }, [kind, project, graphs]);

  if (!project) return null;
  return (
    <Modal title="Export" wide onClose={() => setExportOpen(false)}>
      <div className="sp-export">
        <div className="sp-export-options">
          {OPTIONS.map((item) => (
            <button key={item.id} type="button" className={item.id === kind ? "is-active" : ""} onClick={() => setKind(item.id)}>
              <strong>{item.title}</strong>
            </button>
          ))}
        </div>
        <div className="sp-export-preview">
          <p className="sp-muted">
            <code>
              {kind === "bundle"
                ? `${slugify(project.name)}.json`
                : kind === "screenplay"
                  ? `${slugify(project.name)}-screenplay.md`
                  : `${slugify(project.name)}-voices.md`}
            </code>
          </p>
          <pre>{text}</pre>
          <div className="sp-modal-actions">
            {saved && (
              <span key={saved.at} className="sp-saved" role="status">
                Saved to <code>{saved.path}</code>
              </span>
            )}
            <button
              type="button"
              className="sp-btn"
              onClick={() => {
                void navigator.clipboard.writeText(text).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                });
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" className="sp-btn is-primary" disabled={busy} onClick={() =>
                void exportToFile(kind).then((path) => {
                  if (path) setSaved({ path, at: Date.now() });
                })
              }>
              Save file
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
