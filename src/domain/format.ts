import { entityLabel } from "./names";
import type { EntityKind, ProjectDocument, Scalar, StoryEntity, VariableDef, VariableValue } from "./types";

export function variableById(project: ProjectDocument, id: string): VariableDef | undefined {
  return project.variables.find((variable) => variable.id === id);
}

export function libraryKind(screen: "characters" | "items" | "locations"): EntityKind {
  if (screen === "characters") return "character";
  if (screen === "items") return "item";
  return "location";
}

export function entitiesOf(project: ProjectDocument, kind: EntityKind): StoryEntity[] {
  if (kind === "character") return project.characters;
  if (kind === "item") return project.items;
  return project.locations;
}

export function entityName(project: ProjectDocument, id: string | null | undefined): string {
  if (!id) return "unset";
  for (const entity of [...project.characters, ...project.items, ...project.locations]) {
    if (entity.id === id) return entityLabel(project, entity);
  }
  return "missing";
}

export function speakerName(project: ProjectDocument, id: string | null): string {
  if (!id) return "Narration";
  const character = project.characters.find((entity) => entity.id === id);
  return character ? entityLabel(project, character) : "Unknown speaker";
}

export function formatValue(
  project: ProjectDocument,
  _variable: VariableDef | undefined,
  value: VariableValue,
): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "empty";
    return value.map((id) => entityName(project, id)).join(", ");
  }
  if (value === null) return "unset";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  const named = entityName(project, value);
  return named === "missing" ? value : named;
}

export function withEntities(project: ProjectDocument, kind: EntityKind, entities: StoryEntity[]): ProjectDocument {
  if (kind === "character") return { ...project, characters: entities };
  if (kind === "item") return { ...project, items: entities };
  return { ...project, locations: entities };
}

export function defaultForKind(kind: string | undefined): Scalar {
  if (kind === "boolean") return true;
  if (kind === "value") return 0;
  return null;
}
