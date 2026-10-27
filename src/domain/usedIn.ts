import { involvedIndex, involvement } from "./involved";
import { buildOutline, type OutlineRow } from "./outline";
import type { Condition, EntityKind, GraphDocument, ProjectDocument, StoryNode } from "./types";

export type UseKind = "location" | "listed" | "speaks" | "effect" | "condition";

export interface UsedInEntry {
  graphId: string;
  node: StoryNode;
  ways: UseKind[];
}

const ENTITY_KINDS = new Set(["character", "item", "location", "inventory"]);

/** Beats that use an entity, in outline order. Transition conditions count for the beat they leave. */
export function usedIn(
  project: ProjectDocument,
  graphs: Record<string, GraphDocument>,
  kind: EntityKind,
  entityId: string,
): UsedInEntry[] {
  const index = involvedIndex(graphs);
  const entityVars = new Set(project.variables.filter((item) => ENTITY_KINDS.has(item.kind)).map((item) => item.id));
  const entries: UsedInEntry[] = [];
  const seenGraphs = new Set<string>();

  const check = (row: OutlineRow) => {
    const { node, graphId } = row;
    const own = involvement(index, graphId, node.id).own;
    const ways: UseKind[] = [];
    if (kind === "location" && own.locationIds.includes(entityId)) ways.push("location");
    if (kind === "character") {
      if (node.characterIds.includes(entityId)) ways.push("listed");
      if (node.lines.some((line) => line.speakerId === entityId)) ways.push("speaks");
    }
    if (kind === "item" && own.itemIds.includes(entityId)) ways.push("listed");
    if (node.effects.some((effect) => entityVars.has(effect.variableId) && effect.value === entityId)) ways.push("effect");
    const graph = graphs[graphId];
    if (graph?.edges.some((edge) => edge.source === node.id && edge.condition && mentions(edge.condition, entityId, entityVars))) {
      ways.push("condition");
    }
    if (ways.length > 0) entries.push({ graphId, node, ways });
  };

  const walk = (rows: OutlineRow[]) => {
    for (const row of rows) {
      seenGraphs.add(row.graphId);
      check(row);
      if (row.children) walk(row.children);
    }
  };
  walk(buildOutline(graphs, project.rootGraphId));
  // Graphs not reachable from the root still count.
  for (const graph of Object.values(graphs)) {
    if (seenGraphs.has(graph.id)) continue;
    for (const node of graph.nodes) check({ key: "", graphId: graph.id, node, depth: 0, children: null });
  }
  return entries;
}

function mentions(condition: Condition, entityId: string, entityVars: Set<string>): boolean {
  if (condition.type === "group") return condition.children.some((child) => mentions(child, entityId, entityVars));
  if (condition.type === "not") return mentions(condition.child, entityId, entityVars);
  if (condition.type === "has") return condition.entityId === entityId;
  return entityVars.has(condition.variableId) && condition.value === entityId;
}
