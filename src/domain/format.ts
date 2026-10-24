import type { ProjectDocument, Scalar, VariableDef } from "./types";

export function variableById(project: ProjectDocument, id: string): VariableDef | undefined {
  return project.variables.find((variable) => variable.id === id);
}

export function tagName(project: ProjectDocument, tagId: string | null | undefined): string {
  if (!tagId) return "unset";
  for (const category of project.tagCategories) {
    const tag = category.tags.find((item) => item.id === tagId);
    if (tag) return tag.name;
  }
  return "missing tag";
}

export function speakerName(project: ProjectDocument, tagId: string | null): string {
  if (!tagId) return "Narration";
  for (const category of project.tagCategories) {
    const tag = category.tags.find((item) => item.id === tagId);
    if (tag) return tag.name;
  }
  return "Unknown speaker";
}

export function formatValue(
  project: ProjectDocument,
  variable: VariableDef | undefined,
  value: Scalar,
): string {
  if (value === null) return "unset";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (!variable || variable.kind === "tag") return tagName(project, value);
  return value;
}

export function characterCategories(project: ProjectDocument) {
  return project.tagCategories.filter((category) => category.isCharacters);
}
