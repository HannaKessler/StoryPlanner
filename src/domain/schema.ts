import {
  BUNDLE_KIND,
  COMPARE_OPS,
  EFFECT_OPS,
  READABLE_SCHEMA_VERSIONS,
  SCHEMA_VERSION,
  type CompareOp,
  type Condition,
  type DialogueLine,
  type Effect,
  type EffectOp,
  type EntityField,
  type EntityKind,
  type GraphDocument,
  type ProjectBundle,
  type ProjectDocument,
  type Scalar,
  type StoryEdge,
  type StoryEntity,
  type StoryNode,
  type VariableDef,
} from "./types";

export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaError";
  }
}

const COMPARE = new Set<string>(COMPARE_OPS);
const EFFECTS = new Set<string>(EFFECT_OPS);
const LEGACY_NODE_TYPES = new Set(["beat", "start", "event", "scene", "dialogue", "end"]);
const ITEM_HINT = /item|inventory|object|prop|gear|weapon|key/i;

export interface TagMigration {
  kinds: Record<string, EntityKind>;
  names: Record<string, string>;
  locationOrder: string[];
}

const EMPTY_MIGRATION: TagMigration = { kinds: {}, names: {}, locationOrder: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(path: string, message: string): never {
  throw new SchemaError(`${path}: ${message}`);
}

function child(path: string, key: string | number): string {
  return typeof key === "number" ? `${path}[${key}]` : `${path}.${key}`;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== "string") fail(path, "expected a string");
  return value;
}

function asNonEmpty(value: unknown, path: string): string {
  const text = asString(value, path);
  if (text.length === 0) fail(path, "expected a non-empty string");
  return text;
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "expected a finite number");
  return value;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, "expected an array");
  return value;
}

function asScalar(value: unknown, path: string): Scalar {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") return asNumber(value, path);
  fail(path, "expected a boolean, number, string, or null");
}

function optionalString(obj: Record<string, unknown>, key: string, path: string): string {
  if (!(key in obj) || obj[key] === undefined) return "";
  return asString(obj[key], child(path, key));
}

function readVersion(obj: Record<string, unknown>, path: string): number {
  if (!("schemaVersion" in obj)) fail(path, "missing schemaVersion");
  const version = asNumber(obj.schemaVersion, child(path, "schemaVersion"));
  if (!(READABLE_SCHEMA_VERSIONS as readonly number[]).includes(version)) {
    fail(
      path,
      `unsupported schemaVersion ${version} (this app reads versions ${READABLE_SCHEMA_VERSIONS.join(", ")})`,
    );
  }
  return version;
}

/** Tag ids from a version 1–3 project, so graph files can be rewritten to entities. */
export function migrationContext(value: unknown): TagMigration {
  if (!isRecord(value) || !Array.isArray(value.tagCategories)) return EMPTY_MIGRATION;
  const kinds: Record<string, EntityKind> = {};
  const names: Record<string, string> = {};
  const locationOrder: string[] = [];
  for (const category of value.tagCategories) {
    if (!isRecord(category) || !Array.isArray(category.tags)) continue;
    const kind = categoryKind(category);
    for (const tag of category.tags) {
      if (!isRecord(tag) || typeof tag.id !== "string" || tag.id.length === 0) continue;
      kinds[tag.id] = kind;
      names[tag.id] = typeof tag.name === "string" && tag.name ? tag.name : tag.id;
      if (kind === "location") locationOrder.push(tag.id);
    }
  }
  return { kinds, names, locationOrder };
}

function categoryKind(category: Record<string, unknown>): EntityKind {
  if (category.isCharacters === true) return "character";
  if (category.isLocations === true) return "location";
  const name = typeof category.name === "string" ? category.name : "";
  if (ITEM_HINT.test(name)) return "item";
  return "item";
}

function obviousCategory(category: Record<string, unknown>): boolean {
  if (category.isCharacters === true || category.isLocations === true) return true;
  return ITEM_HINT.test(typeof category.name === "string" ? category.name : "");
}

function parseCondition(value: unknown, path: string): Condition {
  if (!isRecord(value)) fail(path, "expected a condition object");
  const type = asString(value.type, child(path, "type"));
  if (type === "group") {
    const op = asString(value.op, child(path, "op"));
    if (op !== "and" && op !== "or") fail(child(path, "op"), "expected and or or");
    const children = asArray(value.children, child(path, "children")).map((item, index) =>
      parseCondition(item, child(child(path, "children"), index)),
    );
    return { type: "group", op, children };
  }
  if (type === "not") {
    if (!("child" in value)) fail(path, "missing child");
    return { type: "not", child: parseCondition(value.child, child(path, "child")) };
  }
  if (type === "compare") {
    const op = asString(value.op, child(path, "op"));
    if (!COMPARE.has(op)) fail(child(path, "op"), `unknown compare op ${op}`);
    return {
      type: "compare",
      variableId: asString(value.variableId, child(path, "variableId")),
      op: op as CompareOp,
      value: asScalar(value.value, child(path, "value")),
    };
  }
  if (type === "has") {
    return {
      type: "has",
      variableId: asString(value.variableId, child(path, "variableId")),
      entityId: asString(value.entityId, child(path, "entityId")),
    };
  }
  fail(child(path, "type"), `unknown condition type ${type}`);
}

function parseConditionField(value: unknown, path: string): Condition | null {
  if (value === null || value === undefined) return null;
  return parseCondition(value, path);
}

function parseEffect(value: unknown, path: string): Effect {
  if (!isRecord(value)) fail(path, "expected an effect object");
  const op = asString(value.op, child(path, "op"));
  if (!EFFECTS.has(op)) fail(child(path, "op"), `unknown effect op ${op}`);
  return {
    id: asNonEmpty(value.id, child(path, "id")),
    variableId: asString(value.variableId, child(path, "variableId")),
    op: op as EffectOp,
    value: asScalar(value.value, child(path, "value")),
  };
}

function parseLine(value: unknown, path: string): DialogueLine {
  if (!isRecord(value)) fail(path, "expected a dialogue line");
  const speaker = "speakerId" in value ? value.speakerId : value.speakerTagId;
  if (speaker !== null && speaker !== undefined && typeof speaker !== "string") {
    fail(child(path, "speakerId"), "expected a string or null");
  }
  return {
    id: asNonEmpty(value.id, child(path, "id")),
    speakerId: typeof speaker === "string" ? speaker : null,
    text: asString(value.text, child(path, "text")),
    direction: optionalString(value, "direction", path),
  };
}

function parseEffects(value: unknown, path: string): Effect[] {
  return asArray(value ?? [], path).map((item, index) => parseEffect(item, child(path, index)));
}

function effectKey(effect: Effect): string {
  return `${effect.variableId}\0${effect.op}\0${JSON.stringify(effect.value)}`;
}

function parseIdList(value: unknown, path: string): string[] {
  if (value === undefined || value === null) return [];
  return asArray(value, path).map((item, index) => asNonEmpty(item, child(path, index)));
}

function parseNode(value: unknown, path: string, context: TagMigration): StoryNode {
  if (!isRecord(value)) fail(path, "expected a node");
  const type = asString(value.type, child(path, "type"));
  if (!LEGACY_NODE_TYPES.has(type)) fail(child(path, "type"), `unknown node type ${type}`);
  if (!isRecord(value.position)) fail(child(path, "position"), "expected a point");
  const subgraph = value.subgraphId;
  if (subgraph !== null && subgraph !== undefined && typeof subgraph !== "string") {
    fail(child(path, "subgraphId"), "expected a string or null");
  }
  let sceneNotes = optionalString(value, "sceneNotes", path);
  let locationId: string | null = null;
  let characterIds: string[] = [];
  let itemIds: string[] = [];
  if (Array.isArray(value.tagIds)) {
    const tagIds = parseIdList(value.tagIds, child(path, "tagIds"));
    const ordered = context.locationOrder.filter((id) => tagIds.includes(id));
    const extraLocs = tagIds.filter((id) => context.kinds[id] === "location" && !ordered.includes(id));
    const locations = [...ordered, ...extraLocs];
    locationId = locations[0] ?? null;
    const leftover = locations.slice(1);
    characterIds = tagIds.filter((id) => context.kinds[id] === "character");
    itemIds = tagIds.filter((id) => context.kinds[id] === "item");
    const unknown = tagIds.filter((id) => !context.kinds[id]);
    const noted = [...leftover, ...unknown].map((id) => context.names[id] || id);
    if (noted.length > 0) sceneNotes = [sceneNotes, noted.join(", ")].filter(Boolean).join("\n");
  } else {
    if (value.locationId !== null && value.locationId !== undefined && typeof value.locationId !== "string") {
      fail(child(path, "locationId"), "expected a string or null");
    }
    locationId = typeof value.locationId === "string" ? value.locationId : null;
    characterIds = parseIdList(value.characterIds, child(path, "characterIds"));
    itemIds = parseIdList(value.itemIds, child(path, "itemIds"));
  }
  return {
    id: asNonEmpty(value.id, child(path, "id")),
    type: "beat",
    position: {
      x: asNumber(value.position.x, child(child(path, "position"), "x")),
      y: asNumber(value.position.y, child(child(path, "position"), "y")),
    },
    title: asString(value.title, child(path, "title")),
    summary: optionalString(value, "summary", path),
    sceneNotes,
    subgraphId: typeof subgraph === "string" ? subgraph : null,
    locationId,
    characterIds,
    itemIds,
    locationPosition: parseOptionalPoint(value.locationPosition, child(path, "locationPosition")),
    lines: asArray(value.lines ?? [], child(path, "lines")).map((item, index) =>
      parseLine(item, child(child(path, "lines"), index)),
    ),
    effects: parseEffects(value.effects, child(path, "effects")),
  };
}

function parsePoint(value: unknown, path: string): { x: number; y: number } {
  if (!isRecord(value)) fail(path, "expected a point");
  return {
    x: asNumber(value.x, child(path, "x")),
    y: asNumber(value.y, child(path, "y")),
  };
}

function parseOptionalPoint(value: unknown, path: string): { x: number; y: number } | null {
  if (value === undefined || value === null) return null;
  return parsePoint(value, path);
}

function parseLocationBoxes(value: unknown, path: string) {
  if (value === undefined || value === null) return [];
  return asArray(value, path).map((item, index) => {
    const boxPath = child(path, index);
    if (!isRecord(item)) fail(boxPath, "expected a location box");
    const size = parsePoint(
      isRecord(item.size) ? { x: item.size.width, y: item.size.height } : item.size,
      child(boxPath, "size"),
    );
    const id = asNonEmpty(item.id, child(boxPath, "id"));
    return {
      id: id === "unassigned" ? "unplaced" : id,
      position: parsePoint(item.position, child(boxPath, "position")),
      size: { width: size.x, height: size.y },
    };
  });
}

function parseEdge(value: unknown, path: string): StoryEdge {
  if (!isRecord(value)) fail(path, "expected an edge");
  return {
    id: asNonEmpty(value.id, child(path, "id")),
    source: asNonEmpty(value.source, child(path, "source")),
    target: asNonEmpty(value.target, child(path, "target")),
    label: optionalString(value, "label", path),
    condition: parseConditionField(value.condition ?? null, child(path, "condition")),
  };
}

function combineConditions(a: Condition | null, b: Condition | null): Condition | null {
  if (!a) return b;
  if (!b) return a;
  return { type: "group", op: "and", children: [a, b] };
}

/**
 * Version 1 kept player choices and on-enter effects on nodes. Those are folded
 * onto edges here. A later step of the same load moves every edge effect onto
 * its target beat, which is where effects live from version 4 on.
 */
function migrateGraphV1(value: Record<string, unknown>): Record<string, unknown> {
  const nodes = asArray(value.nodes ?? [], "graph.nodes");
  const edges = asArray(value.edges ?? [], "graph.edges");
  const choices = new Map<string, { source: string; choice: Record<string, unknown> }>();
  const onEnter = new Map<string, unknown[]>();
  for (const node of nodes) {
    if (!isRecord(node) || typeof node.id !== "string") continue;
    for (const choice of Array.isArray(node.choices) ? node.choices : []) {
      if (isRecord(choice) && typeof choice.id === "string") {
        choices.set(choice.id, { source: node.id, choice });
      }
    }
    if (Array.isArray(node.effects) && node.effects.length > 0) onEnter.set(node.id, node.effects);
  }
  const migratedEdges = edges.map((edge, index) => {
    if (!isRecord(edge)) return edge;
    const path = child("graph.edges", index);
    const found = typeof edge.choiceId === "string" ? choices.get(edge.choiceId) : undefined;
    const fromChoice = found && found.source === edge.source ? found.choice : null;
    const edgeCondition = parseConditionField(edge.condition ?? null, child(path, "condition"));
    const choiceCondition = fromChoice
      ? parseConditionField(fromChoice.condition ?? null, child(path, "choice.condition"))
      : null;
    const effects: unknown[] = fromChoice && Array.isArray(fromChoice.effects) ? [...fromChoice.effects] : [];
    const entered = typeof edge.target === "string" ? onEnter.get(edge.target) ?? [] : [];
    for (const effect of entered) {
      effects.push(isRecord(effect) ? { ...effect, id: `${String(edge.id)}:${String(effect.id)}` } : effect);
    }
    const prior = Array.isArray(edge.effects) ? edge.effects : [];
    const choiceLabel = typeof fromChoice?.label === "string" ? fromChoice.label : "";
    const label = typeof edge.label === "string" && edge.label ? edge.label : choiceLabel;
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label,
      condition: combineConditions(choiceCondition, edgeCondition),
      effects: [...prior, ...effects],
    };
  });
  return { ...value, edges: migratedEdges };
}

function parseField(value: unknown, path: string): EntityField {
  if (!isRecord(value)) fail(path, "expected a field");
  return {
    key: asString(value.key, child(path, "key")),
    value: asString(value.value, child(path, "value")),
  };
}

function parseEntity(value: unknown, path: string): StoryEntity {
  if (!isRecord(value)) fail(path, "expected an entity");
  const notes = "notes" in value ? optionalString(value, "notes", path) : optionalString(value, "description", path);
  return {
    id: asNonEmpty(value.id, child(path, "id")),
    name: asString(value.name, child(path, "name")),
    notes,
    images: parseIdList(value.images, child(path, "images")).map((item) => item),
    fields: asArray(value.fields ?? [], child(path, "fields")).map((item, index) =>
      parseField(item, child(child(path, "fields"), index)),
    ),
  };
}

function entityFromTag(tag: Record<string, unknown>, category: Record<string, unknown>, path: string): StoryEntity {
  const description = optionalString(tag, "description", path);
  const color = optionalString(tag, "color", path);
  const notes: string[] = [];
  if (description) notes.push(description);
  const fields: EntityField[] = [];
  if (color) fields.push({ key: "color", value: color });
  if (!obviousCategory(category)) {
    const name = optionalString(category, "name", path);
    const about = optionalString(category, "description", path);
    if (name) notes.push(`Category: ${name}`);
    if (about) notes.push(about);
    if (name) fields.push({ key: "category", value: name });
  }
  return {
    id: asNonEmpty(tag.id, child(path, "id")),
    name: asString(tag.name, child(path, "name")),
    notes: notes.join("\n"),
    images: [],
    fields,
  };
}

function entitiesFromCategories(value: unknown): Pick<ProjectDocument, "characters" | "items" | "locations"> {
  const characters: StoryEntity[] = [];
  const items: StoryEntity[] = [];
  const locations: StoryEntity[] = [];
  for (const [index, category] of asArray(value ?? [], "project.tagCategories").entries()) {
    const path = child("project.tagCategories", index);
    if (!isRecord(category)) fail(path, "expected a tag category");
    const kind = categoryKind(category);
    const tags = asArray(category.tags ?? [], child(path, "tags"));
    tags.forEach((tag, tagIndex) => {
      if (!isRecord(tag)) fail(child(child(path, "tags"), tagIndex), "expected a tag");
      const entity = entityFromTag(tag, category, child(child(path, "tags"), tagIndex));
      if (kind === "character") characters.push(entity);
      else if (kind === "location") locations.push(entity);
      else items.push(entity);
    });
  }
  return { characters, items, locations };
}

function parseEntityList(value: unknown, path: string): StoryEntity[] {
  return asArray(value ?? [], path).map((item, index) => parseEntity(item, child(path, index)));
}

function parseVariable(value: unknown, path: string, categories: Record<string, unknown>[]): VariableDef {
  if (!isRecord(value)) fail(path, "expected a variable");
  let kind = asNonEmpty(value.kind, child(path, "kind"));
  if (kind === "tag") {
    const categoryId = typeof value.tagCategoryId === "string" ? value.tagCategoryId : "";
    const category = categories.find((item) => item.id === categoryId);
    const name = typeof value.name === "string" ? value.name : "";
    const categoryName = category && typeof category.name === "string" ? category.name : "";
    if (/inventory/i.test(name) || /inventory/i.test(categoryName)) {
      kind = "inventory";
    } else {
      kind = category ? categoryKind(category) : "item";
    }
  }
  return {
    id: asNonEmpty(value.id, child(path, "id")),
    name: asString(value.name, child(path, "name")),
    kind,
    description: optionalString(value, "description", path),
  };
}

function rawCategories(value: Record<string, unknown>): Record<string, unknown>[] {
  if (!Array.isArray(value.tagCategories)) return [];
  return value.tagCategories.filter(isRecord);
}

export function parseProject(value: unknown): ProjectDocument {
  if (!isRecord(value)) fail("project", "expected an object");
  const version = readVersion(value, "project");
  const fromTags = version < 4 || !("characters" in value);
  const entities = fromTags
    ? entitiesFromCategories(value.tagCategories)
    : {
        characters: parseEntityList(value.characters, "project.characters"),
        items: parseEntityList(value.items, "project.items"),
        locations: parseEntityList(value.locations, "project.locations"),
      };
  return {
    schemaVersion: SCHEMA_VERSION,
    id: asNonEmpty(value.id, "project.id"),
    name: asString(value.name, "project.name"),
    createdAt: asString(value.createdAt, "project.createdAt"),
    updatedAt: asString(value.updatedAt, "project.updatedAt"),
    rootGraphId: asNonEmpty(value.rootGraphId, "project.rootGraphId"),
    variables: asArray(value.variables ?? [], "project.variables").map((item, index) =>
      parseVariable(item, child("project.variables", index), rawCategories(value)),
    ),
    ...entities,
  };
}

export function parseGraph(input: unknown, context: TagMigration = EMPTY_MIGRATION): GraphDocument {
  if (!isRecord(input)) fail("graph", "expected an object");
  const version = readVersion(input, "graph");
  const value = version === 1 ? migrateGraphV1(input) : input;
  const parentGraphId = value.parentGraphId;
  const parentNodeId = value.parentNodeId;
  if (parentGraphId !== null && typeof parentGraphId !== "string") {
    fail("graph.parentGraphId", "expected a string or null");
  }
  if (parentNodeId !== null && typeof parentNodeId !== "string") {
    fail("graph.parentNodeId", "expected a string or null");
  }
  const nodes = asArray(value.nodes ?? [], "graph.nodes").map((item, index) =>
    parseNode(item, child("graph.nodes", index), context),
  );
  const rawEdges = asArray(value.edges ?? [], "graph.edges");
  if (version < 4) {
    rawEdges.forEach((edge, index) => {
      if (!isRecord(edge) || typeof edge.target !== "string") return;
      const target = nodes.find((node) => node.id === edge.target);
      if (!target) return;
      const incoming = parseEffects(edge.effects, child(child("graph.edges", index), "effects"));
      const seen = new Set(target.effects.map(effectKey));
      for (const effect of incoming) {
        const key = effectKey(effect);
        if (seen.has(key)) continue;
        seen.add(key);
        target.effects.push(effect);
      }
    });
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    id: asNonEmpty(value.id, "graph.id"),
    name: asString(value.name, "graph.name"),
    parentGraphId: parentGraphId ?? null,
    parentNodeId: parentNodeId ?? null,
    sceneNotes: optionalString(value, "sceneNotes", "graph"),
    locationBoxes: parseLocationBoxes(value.locationBoxes, "graph.locationBoxes"),
    nodes,
    edges: rawEdges.map((item, index) => parseEdge(item, child("graph.edges", index))),
  };
}

export function parseBundle(value: unknown): ProjectBundle {
  if (!isRecord(value)) fail("bundle", "expected an object");
  readVersion(value, "bundle");
  const kind = asString(value.kind, "bundle.kind");
  if (kind !== BUNDLE_KIND) fail("bundle.kind", `expected ${BUNDLE_KIND}`);
  const context = migrationContext(value.project);
  const graphs = asArray(value.graphs, "bundle.graphs").map((item, index) => {
    try {
      return parseGraph(item, context);
    } catch (error) {
      if (error instanceof SchemaError) fail(child("bundle.graphs", index), error.message);
      throw error;
    }
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: BUNDLE_KIND,
    exportedAt: asString(value.exportedAt, "bundle.exportedAt"),
    project: parseProject(value.project),
    graphs,
  };
}

export function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SchemaError(`${label}: invalid JSON`);
  }
}

export function stringifyDoc(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
