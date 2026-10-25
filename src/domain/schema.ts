import {
  BUNDLE_KIND,
  COMPARE_OPS,
  EFFECT_OPS,
  READABLE_SCHEMA_VERSIONS,
  SCHEMA_VERSION,
  STORY_NODE_TYPES,
  type CompareOp,
  type Condition,
  type DialogueLine,
  type Effect,
  type EffectOp,
  type GraphDocument,
  type ProjectBundle,
  type ProjectDocument,
  type Scalar,
  type StoryEdge,
  type StoryNode,
  type StoryNodeType,
  type Tag,
  type TagCategory,
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
const NODE_TYPES = new Set<string>(STORY_NODE_TYPES);

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

function asBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "expected a boolean");
  return value;
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
      `unsupported schemaVersion ${version} (this app reads versions ${READABLE_SCHEMA_VERSIONS.join(" and ")})`,
    );
  }
  return version;
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
  const speaker = value.speakerTagId;
  if (speaker !== null && typeof speaker !== "string") {
    fail(child(path, "speakerTagId"), "expected a string or null");
  }
  return {
    id: asNonEmpty(value.id, child(path, "id")),
    speakerTagId: speaker ?? null,
    text: asString(value.text, child(path, "text")),
    direction: optionalString(value, "direction", path),
  };
}

function parseEffects(value: unknown, path: string): Effect[] {
  return asArray(value ?? [], path).map((item, index) => parseEffect(item, child(path, index)));
}

function parseNode(value: unknown, path: string): StoryNode {
  if (!isRecord(value)) fail(path, "expected a node");
  const type = asString(value.type, child(path, "type"));
  if (!NODE_TYPES.has(type)) fail(child(path, "type"), `unknown node type ${type}`);
  if (!isRecord(value.position)) fail(child(path, "position"), "expected a point");
  const subgraph = value.subgraphId;
  if (subgraph !== null && subgraph !== undefined && typeof subgraph !== "string") {
    fail(child(path, "subgraphId"), "expected a string or null");
  }
  return {
    id: asNonEmpty(value.id, child(path, "id")),
    type: type as StoryNodeType,
    position: {
      x: asNumber(value.position.x, child(child(path, "position"), "x")),
      y: asNumber(value.position.y, child(child(path, "position"), "y")),
    },
    title: asString(value.title, child(path, "title")),
    summary: optionalString(value, "summary", path),
    sceneNotes: optionalString(value, "sceneNotes", path),
    subgraphId: typeof subgraph === "string" ? subgraph : null,
    tagIds: parseTagIds(value.tagIds, child(path, "tagIds")),
    lines: asArray(value.lines ?? [], child(path, "lines")).map((item, index) =>
      parseLine(item, child(child(path, "lines"), index)),
    ),
  };
}

function parseTagIds(value: unknown, path: string): string[] {
  if (value === undefined || value === null) return [];
  return asArray(value, path).map((item, index) => asNonEmpty(item, child(path, index)));
}

function parseEdge(value: unknown, path: string): StoryEdge {
  if (!isRecord(value)) fail(path, "expected an edge");
  return {
    id: asNonEmpty(value.id, child(path, "id")),
    source: asNonEmpty(value.source, child(path, "source")),
    target: asNonEmpty(value.target, child(path, "target")),
    label: optionalString(value, "label", path),
    condition: parseConditionField(value.condition ?? null, child(path, "condition")),
    effects: parseEffects(value.effects, child(path, "effects")),
  };
}

function combineConditions(a: Condition | null, b: Condition | null): Condition | null {
  if (!a) return b;
  if (!b) return a;
  return { type: "group", op: "and", children: [a, b] };
}

/**
 * Version 1 kept player choices and on-enter effects on nodes. Version 2 keeps
 * all branching logic on edges. A choice folds into the edge that carried it
 * (label, both conditions joined with and, choice effects). On-enter effects
 * are appended to every incoming edge of that node. Choices without an edge,
 * and on-enter effects of a node nobody connects into, have nowhere to go and
 * are dropped.
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
    const choiceLabel = typeof fromChoice?.label === "string" ? fromChoice.label : "";
    const label = typeof edge.label === "string" && edge.label ? edge.label : choiceLabel;
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label,
      condition: combineConditions(choiceCondition, edgeCondition),
      effects,
    };
  });
  return { ...value, edges: migratedEdges };
}

function parseTag(value: unknown, path: string): Tag {
  if (!isRecord(value)) fail(path, "expected a tag");
  return {
    id: asNonEmpty(value.id, child(path, "id")),
    name: asString(value.name, child(path, "name")),
    description: optionalString(value, "description", path),
    color: optionalString(value, "color", path) || "#e3a15a",
  };
}

function parseCategory(value: unknown, path: string): TagCategory {
  if (!isRecord(value)) fail(path, "expected a tag category");
  return {
    id: asNonEmpty(value.id, child(path, "id")),
    name: asString(value.name, child(path, "name")),
    isCharacters: asBoolean(value.isCharacters, child(path, "isCharacters")),
    description: optionalString(value, "description", path),
    isLocations:
      "isLocations" in value && value.isLocations !== undefined
        ? asBoolean(value.isLocations, child(path, "isLocations"))
        : false,
    tags: asArray(value.tags ?? [], child(path, "tags")).map((item, index) =>
      parseTag(item, child(child(path, "tags"), index)),
    ),
  };
}

function parseVariable(value: unknown, path: string): VariableDef {
  if (!isRecord(value)) fail(path, "expected a variable");
  const kind = asNonEmpty(value.kind, child(path, "kind"));
  const defaultValue = asScalar(value.defaultValue, child(path, "defaultValue"));
  if (kind === "boolean" && typeof defaultValue !== "boolean") {
    fail(child(path, "defaultValue"), "boolean variables need a boolean default");
  }
  if (kind === "value" && typeof defaultValue !== "number") {
    fail(child(path, "defaultValue"), "value variables need a numeric default");
  }
  if (kind === "tag" && defaultValue !== null && typeof defaultValue !== "string") {
    fail(child(path, "defaultValue"), "tag variables need a tag id or null");
  }
  let tagCategoryId: string | null = null;
  if ("tagCategoryId" in value && value.tagCategoryId != null) {
    tagCategoryId = asString(value.tagCategoryId, child(path, "tagCategoryId"));
  }
  return {
    id: asNonEmpty(value.id, child(path, "id")),
    name: asString(value.name, child(path, "name")),
    kind,
    description: optionalString(value, "description", path),
    defaultValue,
    tagCategoryId,
  };
}

export function parseProject(value: unknown): ProjectDocument {
  if (!isRecord(value)) fail("project", "expected an object");
  readVersion(value, "project");
  return {
    schemaVersion: SCHEMA_VERSION,
    id: asNonEmpty(value.id, "project.id"),
    name: asString(value.name, "project.name"),
    createdAt: asString(value.createdAt, "project.createdAt"),
    updatedAt: asString(value.updatedAt, "project.updatedAt"),
    rootGraphId: asNonEmpty(value.rootGraphId, "project.rootGraphId"),
    variables: asArray(value.variables ?? [], "project.variables").map((item, index) =>
      parseVariable(item, child("project.variables", index)),
    ),
    tagCategories: asArray(value.tagCategories ?? [], "project.tagCategories").map((item, index) =>
      parseCategory(item, child("project.tagCategories", index)),
    ),
  };
}

export function parseGraph(input: unknown): GraphDocument {
  if (!isRecord(input)) fail("graph", "expected an object");
  const value = readVersion(input, "graph") === 1 ? migrateGraphV1(input) : input;
  const parentGraphId = value.parentGraphId;
  const parentNodeId = value.parentNodeId;
  if (parentGraphId !== null && typeof parentGraphId !== "string") {
    fail("graph.parentGraphId", "expected a string or null");
  }
  if (parentNodeId !== null && typeof parentNodeId !== "string") {
    fail("graph.parentNodeId", "expected a string or null");
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    id: asNonEmpty(value.id, "graph.id"),
    name: asString(value.name, "graph.name"),
    parentGraphId: parentGraphId ?? null,
    parentNodeId: parentNodeId ?? null,
    sceneNotes: optionalString(value, "sceneNotes", "graph"),
    nodes: asArray(value.nodes ?? [], "graph.nodes").map((item, index) =>
      parseNode(item, child("graph.nodes", index)),
    ),
    edges: asArray(value.edges ?? [], "graph.edges").map((item, index) =>
      parseEdge(item, child("graph.edges", index)),
    ),
  };
}

export function parseBundle(value: unknown): ProjectBundle {
  if (!isRecord(value)) fail("bundle", "expected an object");
  readVersion(value, "bundle");
  const kind = asString(value.kind, "bundle.kind");
  if (kind !== BUNDLE_KIND) fail("bundle.kind", `expected ${BUNDLE_KIND}`);
  const graphs = asArray(value.graphs, "bundle.graphs").map((item, index) => {
    try {
      return parseGraph(item);
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
