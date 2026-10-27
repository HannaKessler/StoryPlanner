import type { EntityKind, ProjectDocument, StoryEntity } from "./types";

const KIND_NAME: Record<EntityKind, string> = { character: "Character", item: "Item", location: "Location" };

function key(name: string): string {
  return name.trim().toLowerCase();
}

/** True when another entry already uses this name, ignoring case and outer spaces. */
export function isDuplicateName(name: string, others: string[]): boolean {
  const wanted = key(name);
  return wanted !== "" && others.some((other) => key(other) === wanted);
}

/** `base`, or `base 2`, `base 3`, … when the name is taken. */
export function uniqueName(base: string, taken: string[]): string {
  const trimmed = base.trim();
  if (!trimmed || !isDuplicateName(trimmed, taken)) return trimmed;
  const stem = trimmed.replace(/\s+\d+$/, "") || trimmed;
  for (let index = 2; ; index += 1) {
    const candidate = `${stem} ${index}`;
    if (!isDuplicateName(candidate, taken)) return candidate;
  }
}

/** A default name for a new character, item, or location. */
export function newEntityName(kind: EntityKind, entities: StoryEntity[]): string {
  return uniqueName(`${KIND_NAME[kind]} ${entities.length + 1}`, entities.map((entity) => entity.name));
}

function kindOf(project: ProjectDocument, id: string): [EntityKind, StoryEntity[]] | null {
  if (project.characters.some((entity) => entity.id === id)) return ["character", project.characters];
  if (project.items.some((entity) => entity.id === id)) return ["item", project.items];
  if (project.locations.some((entity) => entity.id === id)) return ["location", project.locations];
  return null;
}

/** The name, or a numbered fallback such as `Character 3` for an unnamed entity. Nothing is saved. */
export function entityLabel(project: ProjectDocument, entity: StoryEntity): string {
  const name = entity.name.trim();
  if (name) return name;
  const found = kindOf(project, entity.id);
  if (!found) return "Unnamed";
  const [kind, list] = found;
  return `${KIND_NAME[kind]} ${list.findIndex((item) => item.id === entity.id) + 1}`;
}
