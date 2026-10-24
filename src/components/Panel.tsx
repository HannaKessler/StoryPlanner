import { useState, type ReactNode } from "react";

const openState = new Map<string, boolean>();

/** Collapsible panel section. Open/closed is remembered per id for the session. */
export function Section({
  id,
  title,
  count,
  summary,
  actions,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  summary?: string;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => openState.get(id) ?? defaultOpen);
  const toggle = () => {
    openState.set(id, !open);
    setOpen(!open);
  };
  return (
    <section className={open ? "sp-sec is-open" : "sp-sec"}>
      <header className="sp-sec-head">
        <button type="button" className="sp-sec-toggle" onClick={toggle} aria-expanded={open}>
          <span className="sp-chev" aria-hidden>
            {open ? "▾" : "▸"}
          </span>
          <span className="sp-sec-title">{title}</span>
          {count !== undefined && <span className="sp-sec-count">{count}</span>}
          {!open && summary && <span className="sp-sec-summary">{summary}</span>}
        </button>
        {actions && <div className="sp-sec-actions">{actions}</div>}
      </header>
      {open && <div className="sp-sec-body">{children}</div>}
    </section>
  );
}

/** Label-left, control-right row used across the side panels. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="sp-row">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={danger ? "sp-mini is-danger" : "sp-mini"}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}
