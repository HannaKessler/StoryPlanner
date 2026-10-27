import { entitiesOf, withEntities } from "./format";
import type {
  Condition,
  Effect,
  EntityKind,
  GraphDocument,
  ProjectDocument,
  StoryNode,
  VariableDef,
  VariableValue,
} from "./types";

/** Variable kinds whose scalar value is an entity id. */
const ENTITY_VALUE_KINDS = new Set(["character", "item", "location", "inventory"]);

/** Location-view boxes that are not locations. */
const SPECIAL_BOXES = new Set(["unplaced", "multiple"]);

interface Rules {
  /** True when this entity id must go. Empty ids are never passed. */
  badEntity: (id: string) => boolean;
  /** True when this variable id must go. */
  badVariable: (id: string) => boolean;
}

interface Scrubbed {
  project: ProjectDocument;
  graphs: Record<string, GraphDocument>;
  /** References removed or cleared. Layout boxes are not counted. */
  count: number;
}

/**
 * Removes every reference matched by `rules`. Untouched objects keep their
 * identity so callers can tell whether anything changed.
 */
function scrub(project: ProjectDocument, graphs: Record<string, GraphDocument>, rules: Rules): Scrubbed {
  let count = 0;
  const kinds = new Map(project.variables.map((variable) => [variable.id, variable.kind]));
  const holdsEntity = (variableId: string) => ENTITY_VALUE_KINDS.has(kinds.get(variableId) ?? "");
  const badValue = (variableId: string, value: unknown) =>
    typeof value === "string" && value !== "" && holdsEntity(variableId) && rules.badEntity(value);

  const pruneCondition = (condition: Condition): Condition | null => {
    if (condition.type === "group") {
      const children: Condition[] = [];
      let changed = false;
      for (const child of condition.children) {
        const next = pruneCondition(child);
        if (next !== child) changed = true;
        if (next) children.push(next);
      }
      if (!changed) return condition;
      return children.length === 0 ? null : { ...condition, children };
    }
    if (condition.type === "not") {
      const child = pruneCondition(condition.child);
      if (child === condition.child) return condition;
      return child ? { ...condition, child } : null;
    }
    if (rules.badVariable(condition.variableId)) {
      count += 1;
      return null;
    }
    if (condition.type === "has") {
      if (condition.entityId && rules.badEntity(condition.entityId)) {
        count += 1;
        return null;
      }
      return condition;
    }
    if (badValue(condition.variableId, condition.value)) {
      count += 1;
      return null;
    }
    return condition;
  };

  const keepEffect = (effect: Effect) => {
    if (rules.badVariable(effect.variableId) || badValue(effect.variableId, effect.value)) {
      count += 1;
      return false;
    }
    return true;
  };

  const scrubIds = (ids: string[]): string[] => {
    const next = ids.filter((id) => !rules.badEntity(id));
    count += ids.length - next.length;
    return next.length === ids.length ? ids : next;
  };

  const scrubNode = (node: StoryNode): StoryNode => {
    let changed = false;
    let locationId = node.locationId;
    if (locationId && rules.badEntity(locationId)) {
      locationId = null;
      count += 1;
      changed = true;
    }
    const characterIds = scrubIds(node.characterIds);
    const itemIds = scrubIds(node.itemIds);
    if (characterIds !== node.characterIds || itemIds !== node.itemIds) changed = true;
    let linesChanged = false;
    const lines = node.lines.map((line) => {
      if (line.speakerId && rules.badEntity(line.speakerId)) {
        count += 1;
        linesChanged = true;
        return { ...line, speakerId: null };
      }
      return line;
    });
    const effects = node.effects.filter(keepEffect);
    if (linesChanged || effects.length !== node.effects.length) changed = true;
    if (!changed) return node;
    return {
      ...node,
      locationId,
      characterIds,
      itemIds,
      lines: linesChanged ? lines : node.lines,
      effects: effects.length === node.effects.length ? node.effects : effects,
    };
  };

  const nextGraphs: Record<string, GraphDocument> = {};
  let graphsChanged = false;
  for (const [id, graph] of Object.entries(graphs)) {
    const nodes = graph.nodes.map(scrubNode);
    let edgesChanged = false;
    const edges = graph.edges.map((edge) => {
      if (!edge.condition) return edge;
      const condition = pruneCondition(edge.condition);
      if (condition === edge.condition) return edge;
      edgesChanged = true;
      return { ...edge, condition };
    });
    const locationBoxes = graph.locationBoxes.filter((box) => SPECIAL_BOXES.has(box.id) || !rules.badEntity(box.id));
    const nodesChanged = nodes.some((node, index) => node !== graph.nodes[index]);
    const boxesChanged = locationBoxes.length !== graph.locationBoxes.length;
    if (nodesChanged || edgesChanged || boxesChanged) {
      graphsChanged = true;
      nextGraphs[id] = {
        ...graph,
        nodes: nodesChanged ? nodes : graph.nodes,
        edges: edgesChanged ? edges : graph.edges,
        locationBoxes: boxesChanged ? locationBoxes : graph.locationBoxes,
      };
    } else {
      nextGraphs[id] = graph;
    }
  }

  let variablesChanged = false;
  const variables = project.variables
    .filter((variable) => !rules.badVariable(variable.id))
    .map((variable) => {
      const value = scrubDefault(variable, rules, holdsEntity(variable.id));
      if (value === variable.defaultValue) return variable;
      variablesChanged = true;
      count += Array.isArray(variable.defaultValue) && Array.isArray(value) ? variable.defaultValue.length - value.length : 1;
      return { ...variable, defaultValue: value };
    });
  if (variables.length !== project.variables.length) variablesChanged = true;

  return {
    project: variablesChanged ? { ...project, variables } : project,
    graphs: graphsChanged ? nextGraphs : graphs,
    count,
  };
}

function scrubDefault(variable: VariableDef, rules: Rules, holdsEntity: boolean): VariableValue {
  const value = variable.defaultValue;
  if (!holdsEntity) return value;
  if (Array.isArray(value)) {
    const next = value.filter((id) => !rules.badEntity(id));
    return next.length === value.length ? value : next;
  }
  if (typeof value === "string" && value && rules.badEntity(value)) return null;
  return value;
}

const none = () => false;

/** How many places use this entity. */
export function countEntityRefs(project: ProjectDocument, graphs: Record<string, GraphDocument>, entityId: string): number {
  return scrub(project, graphs, { badEntity: (id) => id === entityId, badVariable: none }).count;
}

/** How many conditions and effects use this variable. */
export function countVariableRefs(project: ProjectDocument, graphs: Record<string, GraphDocument>, variableId: string): number {
  return scrub(project, graphs, { badEntity: none, badVariable: (id) => id === variableId }).count;
}

/** Deletes an entity and every reference to it. Speakers become narration. */
export function deleteEntity(
  project: ProjectDocument,
  graphs: Record<string, GraphDocument>,
  kind: EntityKind,
  entityId: string,
): { project: ProjectDocument; graphs: Record<string, GraphDocument> } {
  const remaining = entitiesOf(project, kind).filter((entity) => entity.id !== entityId);
  const result = scrub(project, graphs, { badEntity: (id) => id === entityId, badVariable: none });
  return { project: withEntities(result.project, kind, remaining), graphs: result.graphs };
}

/** Deletes a variable, the rules that test it, and the effects that set it. Empty groups collapse. */
export function deleteVariable(
  project: ProjectDocument,
  graphs: Record<string, GraphDocument>,
  variableId: string,
): { project: ProjectDocument; graphs: Record<string, GraphDocument> } {
  const result = scrub(project, graphs, { badEntity: none, badVariable: (id) => id === variableId });
  return { project: result.project, graphs: result.graphs };
}

/** Removes references to entities and variables that no longer exist. */
export function sanitizeReferences(project: ProjectDocument, graphs: Record<string, GraphDocument>): Scrubbed {
  const entities = new Set([...project.characters, ...project.items, ...project.locations].map((entity) => entity.id));
  const variables = new Set(project.variables.map((variable) => variable.id));
  return scrub(project, graphs, {
    badEntity: (id) => !entities.has(id),
    badVariable: (id) => id !== "" && !variables.has(id),
  });
}

/** Every image path referenced by an entity. */
export function referencedImages(project: ProjectDocument): Set<string> {
  const paths = new Set<string>();
  for (const entity of [...project.characters, ...project.items, ...project.locations]) {
    for (const path of entity.images) paths.add(path);
  }
  return paths;
}
