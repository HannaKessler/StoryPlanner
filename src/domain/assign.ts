import type { EntityKind, StoryNode } from "./types";

type Assignable = Pick<StoryNode, "locationId" | "characterIds" | "itemIds">;

/** The patch that gives an event a character, an item, or its location. */
export function assignPatch(node: Assignable, kind: EntityKind, id: string): Partial<StoryNode> {
  if (kind === "location") return { locationId: id };
  if (kind === "character") return { characterIds: node.characterIds.includes(id) ? node.characterIds : [...node.characterIds, id] };
  return { itemIds: node.itemIds.includes(id) ? node.itemIds : [...node.itemIds, id] };
}

/** The patch that takes a character, item or location off an event. */
export function unassignPatch(node: Assignable, kind: EntityKind, id: string): Partial<StoryNode> {
  if (kind === "location") return { locationId: node.locationId === id ? null : node.locationId };
  if (kind === "character") return { characterIds: node.characterIds.filter((item) => item !== id) };
  return { itemIds: node.itemIds.filter((item) => item !== id) };
}

/** Whether the event lists this entity itself, so it can be removed from it. */
export function assigned(node: Assignable, kind: EntityKind, id: string): boolean {
  if (kind === "location") return node.locationId === id;
  return (kind === "character" ? node.characterIds : node.itemIds).includes(id);
}
