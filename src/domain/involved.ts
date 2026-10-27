import type { GraphDocument, StoryNode } from "./types";

/** Entity ids a beat involves. Computed. Not stored on the beat. */
export interface InvolvedSets {
  locationIds: string[];
  characterIds: string[];
  itemIds: string[];
}

export interface NodeInvolvement {
  /** References stored on this beat, including its speakers. */
  own: InvolvedSets;
  /** Present only because a sub-graph, at any depth, involves them. */
  inherited: InvolvedSets;
  all: InvolvedSets;
}

const EMPTY: InvolvedSets = { locationIds: [], characterIds: [], itemIds: [] };

export function ownInvolved(node: StoryNode): InvolvedSets {
  const characters = new Set(node.characterIds);
  for (const line of node.lines) {
    if (line.speakerId) characters.add(line.speakerId);
  }
  return {
    locationIds: node.locationId ? [node.locationId] : [],
    characterIds: [...characters],
    itemIds: unique(node.itemIds),
  };
}

/**
 * Involvement for every beat. Own references union every nested beat, repeating
 * until a cycle stops growing. A beat never reads its parent.
 */
export function indexInvolved(graphs: Record<string, GraphDocument>): Map<string, NodeInvolvement> {
  const rows: Array<{ key: string; node: StoryNode; own: InvolvedSets }> = [];
  const all = new Map<string, InvolvedSets>();
  for (const graph of Object.values(graphs)) {
    for (const node of graph.nodes) {
      const key = `${graph.id}:${node.id}`;
      const own = ownInvolved(node);
      rows.push({ key, node, own });
      all.set(key, own);
    }
  }

  const limit = rows.length + 1;
  for (let pass = 0; pass < limit; pass += 1) {
    let grew = false;
    for (const row of rows) {
      const child = row.node.subgraphId ? graphs[row.node.subgraphId] : undefined;
      if (!child) continue;
      const current = all.get(row.key) ?? EMPTY;
      const locations = new Set(current.locationIds);
      const characters = new Set(current.characterIds);
      const items = new Set(current.itemIds);
      const before = locations.size + characters.size + items.size;
      for (const nested of child.nodes) {
        const nestedAll = all.get(`${child.id}:${nested.id}`) ?? EMPTY;
        for (const id of nestedAll.locationIds) locations.add(id);
        for (const id of nestedAll.characterIds) characters.add(id);
        for (const id of nestedAll.itemIds) items.add(id);
      }
      if (locations.size + characters.size + items.size !== before) {
        all.set(row.key, {
          locationIds: [...locations],
          characterIds: [...characters],
          itemIds: [...items],
        });
        grew = true;
      }
    }
    if (!grew) break;
  }

  const index = new Map<string, NodeInvolvement>();
  for (const row of rows) {
    const combined = all.get(row.key) ?? row.own;
    const ownLocations = new Set(row.own.locationIds);
    const ownCharacters = new Set(row.own.characterIds);
    const ownItems = new Set(row.own.itemIds);
    index.set(row.key, {
      own: row.own,
      inherited: {
        locationIds: combined.locationIds.filter((id) => !ownLocations.has(id)),
        characterIds: combined.characterIds.filter((id) => !ownCharacters.has(id)),
        itemIds: combined.itemIds.filter((id) => !ownItems.has(id)),
      },
      all: combined,
    });
  }
  return index;
}

export function involvement(
  index: Map<string, NodeInvolvement>,
  graphId: string,
  nodeId: string,
): NodeInvolvement {
  return index.get(`${graphId}:${nodeId}`) ?? { own: EMPTY, inherited: EMPTY, all: EMPTY };
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}
