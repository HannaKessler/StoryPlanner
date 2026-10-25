import type { GraphDocument, ProjectDocument, StoryNode, Tag } from "./types";

export const UNASSIGNED_LANE = "unassigned";

const LANE_WIDTH = 268;
const LANE_GAP = 36;
const SLOT = 168;
const PAD_TOP = 40;
const PAD_X = 16;

export interface LocationColumn {
  id: string;
  name: string;
  nodeIds: string[];
}

/** Location tags in project order: category order, then tag order inside each category. */
export function locationTags(project: ProjectDocument): Tag[] {
  const tags: Tag[] = [];
  for (const category of project.tagCategories) {
    if (!category.isLocations) continue;
    tags.push(...category.tags);
  }
  return tags;
}

/**
 * The column a beat is drawn in. A beat with several location tags is drawn
 * once, under the earliest of those tags in project order, so the beat stays
 * one selectable node and each transition is drawn once.
 */
export function primaryLocationId(node: StoryNode, project: ProjectDocument): string | null {
  const have = new Set(node.tagIds);
  return locationTags(project).find((tag) => have.has(tag.id))?.id ?? null;
}

/** Columns for the current graph. Does not read or write saved canvas positions. */
export function locationColumns(graph: GraphDocument, project: ProjectDocument): LocationColumn[] {
  const columns: LocationColumn[] = locationTags(project).map((tag) => ({
    id: tag.id,
    name: tag.name,
    nodeIds: [],
  }));
  const unassigned: LocationColumn = { id: UNASSIGNED_LANE, name: "Unassigned", nodeIds: [] };
  const ranked = graph.nodes
    .map((node, index) => ({ node, index }))
    .sort(
      (a, b) =>
        a.node.position.y - b.node.position.y ||
        a.node.position.x - b.node.position.x ||
        a.index - b.index,
    );
  for (const { node } of ranked) {
    const lane = primaryLocationId(node, project);
    const column = columns.find((item) => item.id === lane) ?? unassigned;
    column.nodeIds.push(node.id);
  }
  return [...columns, unassigned];
}

/** View-only coordinates. Callers must not write these back onto the beats. */
export function locationPlacement(
  graph: GraphDocument,
  project: ProjectDocument,
): Map<string, { x: number; y: number }> {
  const placed = new Map<string, { x: number; y: number }>();
  locationColumns(graph, project).forEach((column, col) => {
    column.nodeIds.forEach((id, index) => {
      placed.set(id, {
        x: col * (LANE_WIDTH + LANE_GAP) + PAD_X,
        y: PAD_TOP + index * SLOT,
      });
    });
  });
  return placed;
}

export function locationLaneFrame(
  graph: GraphDocument,
  project: ProjectDocument,
): Array<{ id: string; name: string; x: number; height: number }> {
  return locationColumns(graph, project).map((column, col) => ({
    id: column.id,
    name: column.name,
    x: col * (LANE_WIDTH + LANE_GAP),
    height: Math.max(120, PAD_TOP + column.nodeIds.length * SLOT + 24),
  }));
}

export const LOCATION_LANE_WIDTH = LANE_WIDTH;
