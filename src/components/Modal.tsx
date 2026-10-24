import type { ReactNode } from "react";

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="sp-modal-back" role="presentation" onMouseDown={onClose}>
      <div
        className={wide ? "sp-modal is-wide" : "sp-modal"}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sp-modal-head">
          <h2>{title}</h2>
          <button type="button" className="sp-icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="sp-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
