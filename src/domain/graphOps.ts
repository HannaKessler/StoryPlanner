import type { GraphDocument, ProjectDocument, StoryNode } from "./types";

export function findEntryNode(graph: GraphDocument): StoryNode | null {
  const start = graph.nodes.find((node) => node.type === "start");
  if (start) return start;
  const targeted = new Set(graph.edges.map((edge) => edge.target));
  return graph.nodes.find((node) => !targeted.has(node.id)) ?? graph.nodes[0] ?? null;
}

export function graphBreadcrumbs(
  graphs: Record<string, GraphDocument>,
  graphId: string,
): Array<{ id: string; name: string }> {
  const crumbs: Array<{ id: string; name: string }> = [];
  const seen = new Set<string>();
  let current: string | null = graphId;
  while (current && !seen.has(current)) {
    seen.add(current);
    const graph: GraphDocument | undefined = graphs[current];
    if (!graph) break;
    crumbs.push({ id: graph.id, name: graph.name || "Untitled graph" });
    current = graph.parentGraphId;
  }
  return crumbs.reverse();
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
