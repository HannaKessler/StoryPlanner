import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { create } from "zustand";
import { assignPatch } from "../domain/assign";
import type { EntityKind } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { ConditionBuilder } from "./ConditionBuilder";
import { useContextMenu } from "./ContextMenu";
import { CreateField } from "./CreateField";
import { EffectsEditor } from "./EffectsEditor";

export type PopoverContent =
  | { kind: "condition"; edgeId: string }
  | { kind: "effects"; nodeId: string }
  | { kind: "entity"; nodeId: string; entity: EntityKind };

type PopoverState = {
  popover: { x: number; y: number; content: PopoverContent } | null;
  open: (x: number, y: number, content: PopoverContent) => void;
  close: () => void;
};

/** One small floating editor at a time, opened from a menu or a card. */
export const usePopover = create<PopoverState>((set) => ({
  popover: null,
  open: (x, y, content) => set({ popover: { x, y, content } }),
  close: () => set({ popover: null }),
}));

export function openPopover(x: number, y: number, content: PopoverContent) {
  // Opened from a menu item, the menu closes first, so wait for that click to finish.
  window.setTimeout(() => usePopover.getState().open(x, y, content), 0);
}

const ENTITY_LABEL: Record<EntityKind, string> = { character: "Character", item: "Item", location: "Location" };

export function Popover() {
  const popover = usePopover((state) => state.popover);
  const close = usePopover((state) => state.close);
  const graph = useProjectStore((state) => (state.currentGraphId ? state.graphs[state.currentGraphId] : undefined));
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);

  const content = popover?.content;
  const node = content && content.kind !== "condition" ? graph?.nodes.find((item) => item.id === content.nodeId) : undefined;
  const edge = content?.kind === "condition" ? graph?.edges.find((item) => item.id === content.edgeId) : undefined;
  const gone = Boolean(popover && !node && !edge);

  useEffect(() => {
    if (gone) close();
  }, [gone, close]);

  useLayoutEffect(() => {
    if (!popover || !ref.current) {
      setPlace(null);
      return;
    }
    const { width, height } = ref.current.getBoundingClientRect();
    setPlace({
      left: Math.max(4, Math.min(popover.x, window.innerWidth - width - 8)),
      top: Math.max(4, Math.min(popover.y, window.innerHeight - height - 8)),
    });
  }, [popover]);

  useEffect(() => {
    if (!popover) return;
    // Focus lands inside once the menu that opened this has given focus back.
    const frame = window.requestAnimationFrame(() => {
      ref.current?.querySelector<HTMLElement>("input, select, textarea, button:not(:disabled)")?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [popover]);

  useEffect(() => {
    if (!popover) return;
    const outside = (target: EventTarget | null) =>
      target instanceof Node && !ref.current?.contains(target) && !(target instanceof Element && target.closest(".sp-context"));
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || useContextMenu.getState().menu) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    const onDown = (event: MouseEvent) => {
      if (outside(event.target)) close();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("resize", close);
    };
  }, [popover, close]);

  if (!popover || gone) return null;
  const state = useProjectStore.getState();
  let body = null;
  if (content?.kind === "condition" && edge) {
    body = <ConditionBuilder value={edge.condition} onChange={(condition) => state.updateEdge(edge.id, { condition })} />;
  } else if (content?.kind === "effects" && node) {
    body = (
      <>
        <EffectsEditor
          effects={node.effects}
          onAdd={() => state.addNodeEffect(node.id)}
          onUpdate={(effectId, patch) => state.updateNodeEffect(node.id, effectId, patch)}
          onDelete={(effectId) => state.deleteNodeEffect(node.id, effectId)}
          onMove={(effectId, direction) => state.moveNodeEffect(node.id, effectId, direction)}
        />
        <button type="button" className="sp-chip-btn" onClick={() => state.addNodeEffect(node.id)}>
          + effect
        </button>
      </>
    );
  } else if (content?.kind === "entity" && node) {
    const kind = content.entity;
    body = (
      <CreateField
        kind={kind}
        label={`${ENTITY_LABEL[kind]} name`}
        exclude={kind === "character" ? node.characterIds : kind === "item" ? node.itemIds : node.locationId ? [node.locationId] : []}
        onPick={(id) => {
          const current = useProjectStore.getState().graphs[useProjectStore.getState().currentGraphId ?? ""]?.nodes.find((item) => item.id === node.id);
          if (current) useProjectStore.getState().updateNode(node.id, assignPatch(current, kind, id));
        }}
        onClose={close}
      />
    );
  }
  return (
    <div
      ref={ref}
      className={`sp-popover is-${content?.kind}`}
      role="dialog"
      aria-label={content?.kind === "condition" ? "Condition" : content?.kind === "effects" ? "Effects" : "Add"}
      style={{ left: place?.left ?? popover.x, top: place?.top ?? popover.y, visibility: place ? "visible" : "hidden" }}
      onContextMenu={(event) => event.stopPropagation()}
    >
      {body}
    </div>
  );
}
