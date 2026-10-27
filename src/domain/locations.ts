import { indexInvolved, involvement } from "./involved";
import type { GraphDocument, ProjectDocument, StoryNode } from "./types";

/** Beats with no place of their own, and no single inherited place, share this box. */
export const UNPLACED_LOCATION = "unplaced";
/** Beats with no place of their own and more than one inherited place. */
export const MULTI_LOCATION = "multiple";

const PAD = 16;
const TITLE = 36;
const CARD_W = 230;
const STACK_GAP = 16;
const BOX_GAP = 72;
const MIN_W = PAD + CARD_W + PAD;
const MIN_H = TITLE + 96;

/** Height the location layout reserves for a card. Lines, notes, and refs add rows. */
function cardHeight(node: StoryNode | undefined, extraRows = 0): number {
  if (!node) return 72;
  let body = node.title.trim() ? 18 : 0;
  body += extraRows * 16;
  if (node.summary.trim()) body += Math.max(1, Math.ceil(node.summary.trim().length / 30)) * 16;
  if (node.sceneNotes.trim()) body += Math.max(1, Math.ceil(node.sceneNotes.trim().length / 30)) * 16;
  for (const line of node.lines) {
    const chars = 14 + line.text.length;
    body += Math.max(1, Math.ceil(chars / 30)) * 16;
  }
  if (node.effects.length > 0) body += node.effects.length * 14;
  return Math.max(40, 16 + body);
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

/** The box a beat is drawn in. Own location wins. One inherited location is used. Several inherited locations share a box. */
export function placementLocationId(
  node: StoryNode,
  inheritedLocationIds: string[],
): string {
  if (node.locationId) return node.locationId;
  if (inheritedLocationIds.length === 1) return inheritedLocationIds[0];
  if (inheritedLocationIds.length > 1) return MULTI_LOCATION;
  return UNPLACED_LOCATION;
}

/** Boxes for the current graph, including an empty Unplaced box. Does not read graph-view positions except to order beats that have no saved location point. */
export function locationGroups(
  graph: GraphDocument,
  project: ProjectDocument,
  graphs: Record<string, GraphDocument> = { [graph.id]: graph },
): Array<{ id: string; name: string; nodeIds: string[] }> {
  const index = indexInvolved(graphs);
  const groups = project.locations.map((location) => ({
    id: location.id,
    name: location.name || "Untitled",
    nodeIds: [] as string[],
  }));
  const multiple = { id: MULTI_LOCATION, name: "Multiple", nodeIds: [] as string[] };
  const unplaced = { id: UNPLACED_LOCATION, name: "Unplaced", nodeIds: [] as string[] };
  const ranked = graph.nodes
    .map((node, index) => ({ node, order: index }))
    .sort(
      (a, b) =>
        a.node.position.y - b.node.position.y ||
        a.node.position.x - b.node.position.x ||
        a.order - b.order,
    );
  for (const { node } of ranked) {
    const place = placementLocationId(node, involvement(index, graph.id, node.id).inherited.locationIds);
    const group = groups.find((item) => item.id === place) ?? (place === MULTI_LOCATION ? multiple : unplaced);
    group.nodeIds.push(node.id);
  }
  return [...groups, ...(multiple.nodeIds.length > 0 ? [multiple] : []), unplaced];
}

/**
 * Box frames for the location view. Saved box positions and saved beat points
 * are used when present; everything else gets a default that fits the beats.
 * This does not write the graph.
 */
export function locationFrames(
  graph: GraphDocument,
  project: ProjectDocument,
  graphs: Record<string, GraphDocument> = { [graph.id]: graph },
): LocationFrame[] {
  const saved = new Map(graph.locationBoxes.map((box) => [box.id, box]));
  const involved = indexInvolved(graphs);
  const drafts = locationGroups(graph, project, graphs).map((group) => {
    const placed = new Map<string, { x: number; y: number }>();
    const heightOf = (id: string) => {
      const node = graph.nodes.find((item) => item.id === id);
      const info = involvement(involved, graph.id, id);
      const extra = [info.all.locationIds, info.all.characterIds, info.all.itemIds].filter((ids) => ids.length > 0).length;
      return cardHeight(node, extra);
    };
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
