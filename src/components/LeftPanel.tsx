import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { nextBeatPosition } from "../domain/graphOps";
import { beatLabel } from "../domain/labels";
import { ancestorKeys, buildOutline, outlineKey, visibleRows, type OutlineRow } from "../domain/outline";
import { useProjectStore } from "../store/projectStore";
import { menuHandler } from "./ContextMenu";
import { addBeatItems, beatItems } from "./menuItems";
import { Section } from "./Panel";
import { VariablesPanel } from "./VariablesPanel";

export function LeftPanel({ outlineOnly = false }: { outlineOnly?: boolean }) {
  return (
    <aside className="sp-left sp-panel">
      <BeatsOutline />
      {!outlineOnly && <VariablesPanel />}
    </aside>
  );
}

function BeatsOutline() {
  const project = useProjectStore((state) => state.project);
  const graphs = useProjectStore((state) => state.graphs);
  const currentGraphId = useProjectStore((state) => state.currentGraphId);
  const selection = useProjectStore((state) => state.selection);
  const rootId = project?.rootGraphId ?? "";
  const tree = useMemo(() => buildOutline(graphs, rootId), [graphs, rootId]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // The graph open on the canvas always shows in the outline.
  useEffect(() => {
    if (!currentGraphId) return;
    const keys = ancestorKeys(graphs, currentGraphId);
    setExpanded((current) => (keys.every((key) => current.has(key)) ? current : new Set([...current, ...keys])));
  }, [currentGraphId, graphs]);

  const rows = visibleRows(tree, expanded);
  const activeKey = selection?.kind === "node" && currentGraphId ? outlineKey(currentGraphId, selection.id) : null;
  const focusKey = rows.some((row) => row.key === activeKey) ? activeKey : rows[0]?.key;

  useEffect(() => {
    if (!activeKey) return;
    listRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(activeKey)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeKey]);

  if (!project) return null;
  const total = Object.values(graphs).reduce((sum, graph) => sum + graph.nodes.length, 0);

  const focusRow = (key: string | undefined) => {
    if (!key) return;
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)?.focus());
  };
  const pick = (row: OutlineRow) => useProjectStore.getState().selectBeat(row.graphId, row.node.id);
  const toggle = (row: OutlineRow, open: boolean) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (open) next.add(row.key);
      else next.delete(row.key);
      return next;
    });
  const move = (row: OutlineRow) => {
    pick(row);
    focusRow(row.key);
  };
  const addAfter = (row: OutlineRow) => {
    pick(row);
    const state = useProjectStore.getState();
    const graph = state.graphs[row.graphId];
    if (!graph) return;
    state.addConnectedNode(row.node.id, nextBeatPosition(graph, row.node.id));
    const created = useProjectStore.getState().selection;
    if (created?.kind === "node" && created.id !== row.node.id) setRenaming(outlineKey(row.graphId, created.id));
  };

  const onKey = (event: KeyboardEvent<HTMLElement>, row: OutlineRow, index: number) => {
    const open = Boolean(row.children && expanded.has(row.key));
    let handled = true;
    if (event.key === "ArrowDown") {
      if (rows[index + 1]) move(rows[index + 1]);
    } else if (event.key === "ArrowUp") {
      if (rows[index - 1]) move(rows[index - 1]);
    } else if (event.key === "ArrowRight") {
      if (row.children && !open) toggle(row, true);
      else if (open && row.children?.[0]) move(row.children[0]);
    } else if (event.key === "ArrowLeft") {
      if (open) toggle(row, false);
      else {
        const parent = rows.slice(0, index).reverse().find((item) => item.depth < row.depth);
        if (parent) move(parent);
      }
    } else if (event.key === "Home") {
      if (rows[0]) move(rows[0]);
    } else if (event.key === "End") {
      if (rows.at(-1)) move(rows.at(-1)!);
    } else if (event.key === "F2") {
      pick(row);
      setRenaming(row.key);
    } else if (event.key === "Enter") {
      addAfter(row);
    } else {
      handled = false;
    }
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <Section id="left:beats" title="Outline" count={total} onContextMenu={menuHandler(() => addBeatItems())}>
      <ul className="sp-beats sp-outline" role="tree" aria-label="Outline" ref={listRef}>
        {rows.map((row, index) => {
          const active = row.key === activeKey;
          const open = Boolean(row.children && expanded.has(row.key));
          return (
            <li
              key={row.key}
              data-key={row.key}
              role="treeitem"
              aria-level={row.depth + 1}
              aria-selected={active}
              aria-expanded={row.children ? open : undefined}
              tabIndex={row.key === focusKey ? 0 : -1}
              className={active ? "is-active" : ""}
              style={{ paddingLeft: row.depth * 14 }}
              onClick={() => pick(row)}
              onDoubleClick={() => setRenaming(row.key)}
              onKeyDown={(event) => onKey(event, row, index)}
              onContextMenu={(event) => {
                pick(row);
                menuHandler(() => beatItems(row.node))(event);
              }}
            >
              <span
                className="sp-outline-toggle"
                aria-hidden="true"
                onClick={(event) => {
                  if (!row.children) return;
                  event.stopPropagation();
                  toggle(row, !open);
                }}
              >
                {row.children ? (open ? "▾" : "▸") : ""}
              </span>
              {renaming === row.key ? (
                <RenameField
                  initial={row.node.title}
                  placeholder={beatLabel(row.node, project)}
                  onDone={(title) => {
                    if (title !== null && title !== row.node.title) useProjectStore.getState().updateNode(row.node.id, { title });
                    setRenaming(null);
                    focusRow(row.key);
                  }}
                />
              ) : (
                <span className={row.node.title.trim() ? "sp-beat-title" : "sp-beat-title sp-unnamed"}>{beatLabel(row.node, project)}</span>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function RenameField({ initial, placeholder, onDone }: { initial: string; placeholder: string; onDone: (title: string | null) => void }) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const finish = (title: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(title);
  };
  return (
    <input
      className="sp-cell sp-outline-input"
      data-draft
      aria-label="Event title"
      autoFocus
      value={value}
      placeholder={placeholder}
      onFocus={(event) => event.currentTarget.select()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(value.trim())}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") finish(value.trim());
        else if (event.key === "Escape") finish(null);
      }}
    />
  );
}
