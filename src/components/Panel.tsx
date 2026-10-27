import { forwardRef, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode, type TextareaHTMLAttributes } from "react";

const openState = new Map<string, boolean>();

/** Collapsible panel section. Open/closed is remembered per id for the session. */
export function Section({
  id,
  title,
  count,
  summary,
  actions,
  defaultOpen = true,
  onContextMenu,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  summary?: string;
  actions?: ReactNode;
  defaultOpen?: boolean;
  onContextMenu?: (event: MouseEvent) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => openState.get(id) ?? defaultOpen);
  const toggle = () => {
    openState.set(id, !open);
    setOpen(!open);
  };
  return (
    <section className={open ? "sp-sec is-open" : "sp-sec"} onContextMenu={onContextMenu}>
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

/**
 * A number input that accepts an empty field or a lone "-" while typing.
 * The value is committed on blur or Enter; text that is not a number reverts.
 */
export function NumberField({
  value,
  onCommit,
  className = "sp-cell",
  label,
}: {
  value: number;
  onCommit: (value: number) => void;
  className?: string;
  label: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const commit = () => {
    if (text === null) return;
    const parsed = Number(text);
    if (text.trim() !== "" && text.trim() !== "-" && Number.isFinite(parsed) && parsed !== value) onCommit(parsed);
    setText(null);
  };
  return (
    <input
      className={className}
      inputMode="decimal"
      data-draft
      aria-label={label}
      value={text ?? String(value)}
      onChange={(event) => {
        if (/^-?\d*\.?\d*$/.test(event.target.value)) setText(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        if (event.key === "Escape") setText(null);
      }}
    />
  );
}

/** A textarea that grows with its text, between `minRows` and `maxRows`. */
export const AutoTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number; maxRows?: number }
>(function AutoTextarea({ minRows = 1, maxRows = 20, value, style, ...rest }, forwarded) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const element = inner.current;
    if (!element) return;
    const css = getComputedStyle(element);
    const line = parseFloat(css.lineHeight) || 18;
    const padding = parseFloat(css.paddingTop) + parseFloat(css.paddingBottom);
    const border = parseFloat(css.borderTopWidth) + parseFloat(css.borderBottomWidth);
    element.style.height = "auto";
    const content = element.scrollHeight - padding;
    const rows = Math.min(Math.max(content, line * minRows), line * maxRows);
    element.style.height = `${Math.ceil(rows + padding + border)}px`;
    element.style.overflowY = content > line * maxRows ? "auto" : "hidden";
  }, [value, minRows, maxRows]);
  return (
    <textarea
      {...rest}
      rows={minRows}
      value={value}
      style={{ resize: "none", ...style }}
      ref={(element) => {
        inner.current = element;
        if (typeof forwarded === "function") forwarded(element);
        else if (forwarded) forwarded.current = element;
      }}
    />
  );
});
