import { beatLabel } from "./labels";
import type { GraphDocument, ProjectDocument, StoryEdge, StoryNode } from "./types";

/** Beats nothing points at. Play offers these first, and any beat can still be chosen. */
export function entryNodes(graph: GraphDocument): StoryNode[] {
  const incoming = new Set(graph.edges.map((edge) => edge.target));
  return graph.nodes.filter((node) => !incoming.has(node.id));
}

/**
 * Splits A→B into A→new→B. The original edge keeps its label and condition
 * and becomes the first leg. The new edge is a plain second leg.
 */
export function splitTransition(graph: GraphDocument, edgeId: string, node: StoryNode, nextEdge: StoryEdge): GraphDocument | null {
  const edge = graph.edges.find((item) => item.id === edgeId);
  if (!edge) return null;
  const source = graph.nodes.find((item) => item.id === edge.source);
  const target = graph.nodes.find((item) => item.id === edge.target);
  if (!source || !target) return null;
  const placed: StoryNode = {
    ...node,
    position: {
      x: (source.position.x + target.position.x) / 2,
      y: (source.position.y + target.position.y) / 2,
    },
  };
  const bridge: StoryEdge = {
    ...nextEdge,
    source: placed.id,
    target: edge.target,
    label: "",
    condition: null,
  };
  return {
    ...graph,
    nodes: [...graph.nodes, placed],
    edges: graph.edges.map((item) => (item.id === edge.id ? { ...item, target: placed.id } : item)).concat(bridge),
  };
}

export function graphBreadcrumbs(
  graphs: Record<string, GraphDocument>,
  graphId: string,
  project?: ProjectDocument | null,
): Array<{ id: string; name: string }> {
  const crumbs: Array<{ id: string; name: string }> = [];
  const seen = new Set<string>();
  let current: string | null = graphId;
  while (current && !seen.has(current)) {
    seen.add(current);
    const graph: GraphDocument | undefined = graphs[current];
    if (!graph) break;
    crumbs.push({ id: graph.id, name: graphName(graph, graphs, project) });
    current = graph.parentGraphId;
  }
  return crumbs.reverse();
}

/** The graph's own name, or a label derived from its parent beat. Does not write either. */
export function graphName(
  graph: GraphDocument,
  graphs: Record<string, GraphDocument>,
  project?: ProjectDocument | null,
): string {
  const name = graph.name.trim();
  if (name) return name;
  if (graph.parentGraphId && graph.parentNodeId) {
    const parent = graphs[graph.parentGraphId];
    const node = parent?.nodes.find((item) => item.id === graph.parentNodeId);
    if (node) return beatLabel(node, project);
  }
  return "Graph";
}

/** The graph id plus every graph nested inside it. */
export function descendantGraphIds(
  graphs: Record<string, GraphDocument>,
  graphId: string,
): string[] {
  const result: string[] = [];
  const stack = [graphId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    const graph: GraphDocument | undefined = graphs[id];
    if (!graph) continue;
    for (const node of graph.nodes) {
      if (node.subgraphId) stack.push(node.subgraphId);
    }
  }
  return result;
}

export function orderedGraphs(
  project: ProjectDocument,
  graphs: Record<string, GraphDocument>,
): GraphDocument[] {
  const result: GraphDocument[] = [];
  const seen = new Set<string>();
  const walk = (id: string | null) => {
    if (!id || seen.has(id)) return;
    const graph: GraphDocument | undefined = graphs[id];
    if (!graph) return;
    seen.add(id);
    result.push(graph);
    for (const node of graph.nodes) walk(node.subgraphId);
  };
  walk(project.rootGraphId);
  for (const graph of Object.values(graphs)) walk(graph.id);
  return result;
}

const CARD_W = 230;
const STEP_X = 280;
const STEP_Y = 90;

function occupied(graph: GraphDocument, point: { x: number; y: number }): boolean {
  return graph.nodes.some((node) => Math.abs(node.position.x - point.x) < CARD_W / 2 && Math.abs(node.position.y - point.y) < 60);
}

/**
 * Where a new beat goes: right of the selected beat, else centred on the
 * view, else right of the rightmost beat. Moves down past beats already there.
 */
export function nextBeatPosition(
  graph: GraphDocument,
  selectedId: string | null,
  viewCenter?: { x: number; y: number } | null,
): { x: number; y: number } {
  const selected = selectedId ? graph.nodes.find((node) => node.id === selectedId) : undefined;
  let point: { x: number; y: number };
  if (selected) point = { x: selected.position.x + STEP_X, y: selected.position.y };
  else if (viewCenter) point = { x: viewCenter.x - CARD_W / 2, y: viewCenter.y - 30 };
  else {
    const maxX = graph.nodes.reduce((max, node) => Math.max(max, node.position.x), -STEP_X + 80);
    point = { x: maxX + STEP_X, y: 140 };
  }
  point = { x: Math.round(point.x), y: Math.round(point.y) };
  for (let tries = 0; tries < 50 && occupied(graph, point); tries += 1) point = { ...point, y: point.y + STEP_Y };
  return point;
}
