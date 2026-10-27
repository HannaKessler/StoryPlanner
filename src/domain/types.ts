/** Document shape shared by every project file, graph file, and bundle. */
export const SCHEMA_VERSION = 4;

/** Older versions this app can still read. They are migrated on load. */
export const READABLE_SCHEMA_VERSIONS = [1, 2, 3, 4] as const;

/**
 * Kinds the editor knows how to edit. `kind` is stored as a plain string so a
 * later version can add kinds without reshaping the file. Unknown kinds are
 * preserved on load and save.
 */
export const KNOWN_VARIABLE_KINDS = ["boolean", "value", "character", "item", "location", "inventory"] as const;
export type KnownVariableKind = (typeof KNOWN_VARIABLE_KINDS)[number];

/** The only beat type. Older files used start, event, scene, dialogue, and end. */
export const STORY_NODE_TYPES = ["beat"] as const;
export type StoryNodeType = (typeof STORY_NODE_TYPES)[number];

export const ENTITY_KINDS = ["character", "item", "location"] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export const COMPARE_OPS = ["eq", "neq", "gt", "gte", "lt", "lte"] as const;
export type CompareOp = (typeof COMPARE_OPS)[number];

export const EFFECT_OPS = ["set", "add", "remove", "toggle", "clear"] as const;
export type EffectOp = (typeof EFFECT_OPS)[number];

/** A boolean, a number, an entity id, or empty. */
export type Scalar = boolean | number | string | null;

/** A scalar, or the item ids held by an inventory variable. */
export type VariableValue = Scalar | string[];

export interface VariableDef {
  id: string;
  name: string;
  /** Open-ended. This version creates boolean, value, character, item, location, and inventory. */
  kind: string;
  description: string;
}

/** A person, place, or thing. Not a graph node. */
export interface StoryEntity {
  id: string;
  name: string;
  notes: string;
  /** Paths relative to the project folder, usually under `assets/`. */
  images: string[];
  /** Writer-defined extra text. Empty until some are added. */
  fields: EntityField[];
}

export interface EntityField {
  key: string;
  value: string;
}

export type Condition =
  | { type: "group"; op: "and" | "or"; children: Condition[] }
  | { type: "not"; child: Condition }
  | { type: "compare"; variableId: string; op: CompareOp; value: Scalar }
  | { type: "has"; variableId: string; entityId: string };

export interface Effect {
  id: string;
  variableId: string;
  op: EffectOp;
  value: Scalar;
}

export interface DialogueLine {
  id: string;
  /** A character id, or null for narration. */
  speakerId: string | null;
  text: string;
  direction: string;
}

/**
 * A state in the story graph. Every beat has the same fields. References
 * stored here are this beat's own; inherited ones are computed from sub-graphs.
 */
export interface StoryNode {
  id: string;
  type: StoryNodeType;
  /** Project-wide display number for untitled events. Set once at creation; 0 when unset. */
  number: number;
  position: { x: number; y: number };
  /** Optional. Empty until the writer names the beat. Display fallbacks are not stored here. */
  title: string;
  summary: string;
  sceneNotes: string;
  /** Another graph file, or null when this beat has no sub-graph. */
  subgraphId: string | null;
  /** This beat's own place. One location, or null. */
  locationId: string | null;
  /** Characters on this beat, not counting speakers and not counting sub-graphs. */
  characterIds: string[];
  /** Items on this beat itself. */
  itemIds: string[];
  /**
   * Point of this beat inside its location box. Null until the location view
   * has placed it. This is not `position`.
   */
  locationPosition: { x: number; y: number } | null;
  lines: DialogueLine[];
  /** Applied when play enters this beat. Transitions do not carry effects. */
  effects: Effect[];
}

/** A location box on the location view. `id` is a location id, `unplaced`, or `multiple`. */
export interface LocationBox {
  id: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

/**
 * A transition between two nodes in the same graph. It is a gate: available
 * when its condition passes, and it changes nothing by itself. Outgoing
 * transitions keep their array order.
 */
export interface StoryEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  condition: Condition | null;
}

export interface GraphDocument {
  schemaVersion: number;
  id: string;
  name: string;
  parentGraphId: string | null;
  parentNodeId: string | null;
  sceneNotes: string;
  /** Location-view boxes. Empty until a box is moved or resized. */
  locationBoxes: LocationBox[];
  nodes: StoryNode[];
  edges: StoryEdge[];
}

export interface ProjectDocument {
  schemaVersion: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  rootGraphId: string;
  variables: VariableDef[];
  characters: StoryEntity[];
  items: StoryEntity[];
  locations: StoryEntity[];
}

export interface ProjectBundle {
  schemaVersion: number;
  kind: "storyplanner.bundle";
  exportedAt: string;
  project: ProjectDocument;
  graphs: GraphDocument[];
}

export const PROJECT_FILE = "project.json";
export const GRAPHS_DIR = "graphs";
export const BUNDLE_KIND = "storyplanner.bundle" as const;
