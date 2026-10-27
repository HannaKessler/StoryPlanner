import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { create } from "zustand";
import { keepsNativeContextMenu } from "../contextMenu";

export type MenuItem =
  | { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean; hint?: string }
  | "separator";

type MenuState = {
  menu: { x: number; y: number; items: MenuItem[] } | null;
  open: (x: number, y: number, items: MenuItem[]) => void;
  close: () => void;
};

export const useContextMenu = create<MenuState>((set) => ({
  menu: null,
  open: (x, y, items) => set({ menu: { x, y, items } }),
  close: () => set({ menu: null }),
}));

/**
 * Opens the shared menu for an element. The innermost handler wins. It must call
 * preventDefault itself because stopping propagation also hides the event from the
 * document-level suppressor.
 */
export function menuHandler(items: () => MenuItem[]) {
  return (event: ReactMouseEvent) => {
    if (keepsNativeContextMenu(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    const list = items();
    if (list.some((item) => item !== "separator")) useContextMenu.getState().open(event.clientX, event.clientY, list);
  };
}

/** Opens the shared menu below a button, for "+" buttons that offer a choice. */
export function openMenuBelow(element: HTMLElement, items: MenuItem[]) {
  const rect = element.getBoundingClientRect();
  useContextMenu.getState().open(rect.left, rect.bottom + 2, items);
}

/** Focuses and selects the inline name field marked with data-rename={id}. */
export function focusRename(id: string) {
  window.setTimeout(() => {
    const field = document.querySelector<HTMLInputElement>(`[data-rename="${CSS.escape(id)}"]`);
    field?.focus();
    field?.select();
  }, 30);
}

export function ContextMenu() {
  const menu = useContextMenu((state) => state.menu);
  const close = useContextMenu((state) => state.close);
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!menu || !ref.current) {
      setPlace(null);
      return;
    }
    const { width, height } = ref.current.getBoundingClientRect();
    setPlace({
      left: Math.max(4, Math.min(menu.x, window.innerWidth - width - 4)),
      top: Math.max(4, Math.min(menu.y, window.innerHeight - height - 4)),
    });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    // The menu takes focus, and gives it back to where it was when it closes.
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (previous && document.contains(previous) && !ref.current?.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
      const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
      if (buttons.length === 0) return;
      event.preventDefault();
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      let next = 0;
      if (event.key === "End") next = buttons.length - 1;
      else if (event.key === "ArrowDown") next = index < 0 ? 0 : (index + 1) % buttons.length;
      else if (event.key === "ArrowUp") next = index <= 0 ? buttons.length - 1 : index - 1;
      buttons[next].focus();
    };
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onScroll = (event: Event) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("wheel", onScroll, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("wheel", onScroll, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [menu, close]);

  if (!menu) return null;
  return (
    <div
      ref={ref}
      className="sp-context"
      role="menu"
      style={{ left: place?.left ?? menu.x, top: place?.top ?? menu.y, visibility: place ? "visible" : "hidden" }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {menu.items.map((item, index) =>
        item === "separator" ? (
          <hr key={`sep-${index}`} role="separator" />
        ) : (
          <button
            key={`${item.label}-${index}`}
            type="button"
            role="menuitem"
            className={item.danger ? "is-danger" : undefined}
            disabled={item.disabled}
            onClick={() => {
              close();
              item.onSelect();
            }}
          >
            <span>{item.label}</span>
            {item.hint && <kbd>{item.hint}</kbd>}
          </button>
        ),
      )}
    </div>
  );
}
