/** Document shape shared by every project file, graph file, and bundle. */
export const SCHEMA_VERSION = 3;

/** Older versions this app can still read. They are migrated on load. */
export const READABLE_SCHEMA_VERSIONS = [1, 2, 3] as const;

/**
 * Kinds the editor knows how to edit. `kind` is stored as a plain string so a
 * later version can add kinds without reshaping the file. Unknown kinds are
 * preserved on load and save.
 */
export const KNOWN_VARIABLE_KINDS = ["boolean", "value", "tag"] as const;
export type KnownVariableKind = (typeof KNOWN_VARIABLE_KINDS)[number];

export const STORY_NODE_TYPES = ["start", "event", "scene", "dialogue", "end"] as const;
export type StoryNodeType = (typeof STORY_NODE_TYPES)[number];

export const COMPARE_OPS = ["eq", "neq", "gt", "gte", "lt", "lte"] as const;
export type CompareOp = (typeof COMPARE_OPS)[number];

export const EFFECT_OPS = ["set", "add", "toggle", "clear"] as const;
export type EffectOp = (typeof EFFECT_OPS)[number];

/** A boolean, a number, a tag id, or an empty tag / unknown value. */
export type Scalar = boolean | number | string | null;

export interface VariableDef {
  id: string;
  name: string;
  /** Open-ended. This version creates `boolean`, `value`, and `tag`. */
  kind: string;
  description: string;
  defaultValue: Scalar;
  /** Category whose tags this variable assigns, when `kind` is `tag`. */
  tagCategoryId: string | null;
}

export interface Tag {
  id: string;
  name: string;
  description: string;
  color: string;
}

export interface TagCategory {
  id: string;
  name: string;
  /** Tags in this category can be picked as dialogue speakers. */
  isCharacters: boolean;
  /** Tags in this category are places. The location view groups beats by them. */
  isLocations: boolean;
  description: string;
  tags: Tag[];
}

export type Condition =
  | { type: "group"; op: "and" | "or"; children: Condition[] }
  | { type: "not"; child: Condition }
  | { type: "compare"; variableId: string; op: CompareOp; value: Scalar };

export interface Effect {
  id: string;
  variableId: string;
  op: EffectOp;
  value: Scalar;
}

export interface DialogueLine {
  id: string;
  /** Null is narration or an unspoken action line. */
  speakerTagId: string | null;
  text: string;
  /** Short parenthetical direction attached to this line. */
  direction: string;
}

/** A state in the story graph. Nodes hold content only; branching lives on edges. */
export interface StoryNode {
  id: string;
  type: StoryNodeType;
  position: { x: number; y: number };
  title: string;
  summary: string;
  sceneNotes: string;
  /** Another graph file, or null when this beat has no inner graph. */
  subgraphId: string | null;
  /** Tags on this beat, including location tags. Order does not pick a primary place. */
  tagIds: string[];
  lines: DialogueLine[];
}

/**
 * A transition between two nodes in the same graph. It is available when its
 * condition passes, and its effects run when play follows it. Outgoing
 * transitions keep their array order.
 */
export interface StoryEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  condition: Condition | null;
  effects: Effect[];
}

export interface GraphDocument {
  schemaVersion: number;
  id: string;
  name: string;
  parentGraphId: string | null;
  parentNodeId: string | null;
  sceneNotes: string;
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
  tagCategories: TagCategory[];
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
