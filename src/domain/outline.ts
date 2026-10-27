import { entryNodes } from "./graphOps";
import type { GraphDocument, StoryNode } from "./types";

export interface OutlineRow {
  key: string;
  graphId: string;
  node: StoryNode;
  depth: number;
  /** Rows of the beat's sub-graph. Null when it has none. */
  children: OutlineRow[] | null;
}

export function outlineKey(graphId: string, nodeId: string): string {
  return `${graphId}:${nodeId}`;
}

function byPosition(a: StoryNode, b: StoryNode): number {
  return a.position.x - b.position.x || a.position.y - b.position.y;
}

/** Beats in reading order: depth-first along transitions from entry beats, then the rest by position. */
export function orderBeats(graph: GraphDocument): StoryNode[] {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const next = new Map<string, StoryNode[]>();
  for (const edge of graph.edges) {
    const target = byId.get(edge.target);
    if (!target || !byId.has(edge.source)) continue;
    next.set(edge.source, [...(next.get(edge.source) ?? []), target]);
  }
  for (const list of next.values()) list.sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);

  const seen = new Set<string>();
  const order: StoryNode[] = [];
  const visit = (start: StoryNode) => {
    const stack = [start];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      order.push(node);
      const targets = next.get(node.id) ?? [];
      for (let index = targets.length - 1; index >= 0; index -= 1) {
        if (!seen.has(targets[index].id)) stack.push(targets[index]);
      }
    }
  };
  for (const entry of [...entryNodes(graph)].sort(byPosition)) visit(entry);
  for (const node of [...graph.nodes].sort(byPosition)) visit(node);
  return order;
}

/** The graph's beats as a tree, each sub-graph nested under its beat. */
export function buildOutline(
  graphs: Record<string, GraphDocument>,
  graphId: string,
  depth = 0,
  seen: Set<string> = new Set(),
): OutlineRow[] {
  const graph = graphs[graphId];
  if (!graph || seen.has(graphId)) return [];
  const inside = new Set(seen).add(graphId);
  return orderBeats(graph).map((node) => {
    const child = node.subgraphId && graphs[node.subgraphId] && !inside.has(node.subgraphId) ? node.subgraphId : null;
    return {
      key: outlineKey(graph.id, node.id),
      graphId: graph.id,
      node,
      depth,
      children: child ? buildOutline(graphs, child, depth + 1, inside) : null,
    };
  });
}

/** Rows that show, given which sub-graph rows are expanded. */
export function visibleRows(rows: OutlineRow[], expanded: Set<string>): OutlineRow[] {
  const out: OutlineRow[] = [];
  const walk = (list: OutlineRow[]) => {
    for (const row of list) {
      out.push(row);
      if (row.children && expanded.has(row.key)) walk(row.children);
    }
  };
  walk(rows);
  return out;
}

/** Keys of the beats that hold a graph, outermost first, so it can be shown expanded. */
export function ancestorKeys(graphs: Record<string, GraphDocument>, graphId: string): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  let graph = graphs[graphId];
  while (graph?.parentGraphId && graph.parentNodeId && !seen.has(graph.id)) {
    seen.add(graph.id);
    keys.unshift(outlineKey(graph.parentGraphId, graph.parentNodeId));
    graph = graphs[graph.parentGraphId];
  }
  return keys;
}

/** Every beat key that holds a sub-graph, for walking the whole tree. */
export function allOutlineKeys(graphs: Record<string, GraphDocument>): string[] {
  const keys: string[] = [];
  for (const graph of Object.values(graphs)) {
    for (const node of graph.nodes) if (node.subgraphId) keys.push(outlineKey(graph.id, node.id));
  }
  return keys;
}
