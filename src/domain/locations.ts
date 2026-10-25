import type { GraphDocument, ProjectDocument, StoryNode, Tag } from "./types";

/** Beats with no location tag share this box. */
export const UNASSIGNED_LOCATION = "unassigned";

const PAD = 16;
const TITLE = 36;
const CARD_W = 230;
const STACK_GAP = 16;
const BOX_GAP = 72;
const MIN_W = PAD + CARD_W + PAD;
const MIN_H = TITLE + 96;

/** Height the location layout reserves for a card. Dialogue grows with every line. */
function cardHeight(node: StoryNode | undefined): number {
  if (!node) return 72;
  let body = node.title.trim() ? 18 : 0;
  if (node.type === "dialogue" && node.lines.length > 0) {
    for (const line of node.lines) {
      const chars = 14 + line.text.length;
      body += Math.max(1, Math.ceil(chars / 30)) * 16;
    }
  } else if (node.summary.trim()) {
    body += Math.max(1, Math.ceil(node.summary.trim().length / 30)) * 16;
  }
  return Math.max(40, 16 + 16 + body);
}

export interface LocationFrameNode {
  id: string;
  /** Point inside the box, not the graph-view position. */
  position: { x: number; y: number };
}

export interface LocationFrame {
  id: string;
  name: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  /** Smallest size that still holds the beats. */
  minWidth: number;
  minHeight: number;
  nodes: LocationFrameNode[];
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
 * The box a beat is drawn in. A beat with several location tags is drawn once,
 * in the earliest of those tags in project order, so it stays one node and
 * each transition is drawn once.
 */
export function primaryLocationId(node: StoryNode, project: ProjectDocument): string | null {
  const have = new Set(node.tagIds);
  return locationTags(project).find((tag) => have.has(tag.id))?.id ?? null;
}

/** Boxes for the current graph, including an empty Unassigned box. Does not read graph-view positions except to order beats that have no saved location point. */
export function locationGroups(
  graph: GraphDocument,
  project: ProjectDocument,
): Array<{ id: string; name: string; nodeIds: string[] }> {
  const groups = locationTags(project).map((tag) => ({
    id: tag.id,
    name: tag.name || "Untitled",
    nodeIds: [] as string[],
  }));
  const unassigned = { id: UNASSIGNED_LOCATION, name: "Unassigned", nodeIds: [] as string[] };
  const ranked = graph.nodes
    .map((node, index) => ({ node, index }))
    .sort(
      (a, b) =>
        a.node.position.y - b.node.position.y ||
        a.node.position.x - b.node.position.x ||
        a.index - b.index,
    );
  for (const { node } of ranked) {
    const place = primaryLocationId(node, project);
    const group = groups.find((item) => item.id === place) ?? unassigned;
    group.nodeIds.push(node.id);
  }
  return [...groups, unassigned];
}

/**
 * Box frames for the location view. Saved box positions and saved beat points
 * are used when present; everything else gets a default that fits the beats.
 * This does not write the graph.
 */
export function locationFrames(graph: GraphDocument, project: ProjectDocument): LocationFrame[] {
  const saved = new Map(graph.locationBoxes.map((box) => [box.id, box]));
  const drafts = locationGroups(graph, project).map((group) => {
    const placed = new Map<string, { x: number; y: number }>();
    const heightOf = (id: string) => cardHeight(graph.nodes.find((node) => node.id === id));
    let bottom = TITLE;
    for (const id of group.nodeIds) {
      const stored = graph.nodes.find((node) => node.id === id)?.locationPosition;
      if (!stored) continue;
      placed.set(id, stored);
      bottom = Math.max(bottom, stored.y + heightOf(id) + STACK_GAP);
    }
    for (const id of group.nodeIds) {
      if (placed.has(id)) continue;
      placed.set(id, { x: PAD, y: bottom });
      bottom += heightOf(id) + STACK_GAP;
    }
    let contentWidth = MIN_W;
    let contentHeight = MIN_H;
    for (const [id, position] of placed) {
      contentWidth = Math.max(contentWidth, position.x + CARD_W + PAD);
      contentHeight = Math.max(contentHeight, position.y + heightOf(id) + PAD);
    }
    return { group, placed, contentWidth, contentHeight, saved: saved.get(group.id) };
  });

  let cursor = 0;
  for (const draft of drafts) {
    if (!draft.saved) continue;
    const width = Math.max(draft.contentWidth, draft.saved.size.width);
    cursor = Math.max(cursor, draft.saved.position.x + width + BOX_GAP);
  }

  return drafts.map((draft) => {
    const width = Math.max(draft.contentWidth, draft.saved?.size.width ?? 0);
    const height = Math.max(draft.contentHeight, draft.saved?.size.height ?? 0);
    const position = draft.saved?.position ?? { x: cursor, y: 0 };
    if (!draft.saved) cursor += width + BOX_GAP;
    return {
      id: draft.group.id,
      name: draft.group.name,
      position,
      size: { width, height },
      minWidth: draft.contentWidth,
      minHeight: draft.contentHeight,
      nodes: draft.group.nodeIds.map((id) => ({ id, position: draft.placed.get(id)! })),
    };
  });
}
