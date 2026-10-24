import { useMemo, useState } from "react";
import { bundleProject, slugify } from "../domain/project";
import { stringifyDoc } from "../domain/schema";
import { exportScreenplay } from "../domain/screenplay";
import { exportVoiceSheets } from "../domain/voices";
import { useProjectStore, type ExportKind } from "../store/projectStore";
import { Modal } from "./Modal";

const OPTIONS: Array<{ id: ExportKind; title: string; detail: string }> = [
  {
    id: "bundle",
    title: "Bundled JSON",
    detail: "The whole project folder in one file for engine add-ons. Schema version included.",
  },
  {
    id: "screenplay",
    title: "Full screenplay",
    detail: "Markdown that follows the branches and keeps scene notes, choices, and conditions.",
  },
  {
    id: "voices",
    title: "Voice actor sheets",
    detail: "One section per character. Each line is preceded by the italic line it answers, including every path.",
  },
];

export function ExportDialog() {
  const project = useProjectStore((state) => state.project);
  const graphs = useProjectStore((state) => state.graphs);
  const setExportOpen = useProjectStore((state) => state.setExportOpen);
  const exportToFile = useProjectStore((state) => state.exportToFile);
  const busy = useProjectStore((state) => state.busy);
  const [kind, setKind] = useState<ExportKind>("bundle");
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => {
    if (!project) return "";
    if (kind === "bundle") return stringifyDoc(bundleProject(project, graphs, new Date().toISOString()));
    if (kind === "screenplay") return exportScreenplay(project, graphs);
    return exportVoiceSheets(project, graphs);
  }, [kind, project, graphs]);

  if (!project) return null;
  const option = OPTIONS.find((item) => item.id === kind) ?? OPTIONS[0];

  return (
    <Modal title="Export" wide onClose={() => setExportOpen(false)}>
      <div className="sp-export">
        <div className="sp-export-options">
          {OPTIONS.map((item) => (
            <button key={item.id} type="button" className={item.id === kind ? "is-active" : ""} onClick={() => setKind(item.id)}>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </button>
          ))}
        </div>
        <div className="sp-export-preview">
          <p className="sp-muted">
            {option.detail} This uses the project as it is now, including unsaved edits. Suggested file:{" "}
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
            <button type="button" className="sp-btn is-primary" disabled={busy} onClick={() => void exportToFile(kind)}>
              Save file
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
