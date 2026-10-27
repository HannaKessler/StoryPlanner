import { describeCondition, evaluateCondition } from "./conditions";
import { applyEffects, defaultValues } from "./effects";
import { entryNodes } from "./graphOps";
import { beatLabel } from "./labels";
import type { GraphDocument, ProjectDocument, StoryNode, VariableDef, VariableValue } from "./types";

export interface PlayFrame {
  graphId: string;
  nodeId: string;
}

export interface PlayState {
  frames: PlayFrame[];
  values: Record<string, VariableValue>;
  /** Titles of beats entered, in order. */
  log: string[];
  /** When set, play is waiting for a beat to enter in this graph. */
  choosingGraphId: string | null;
}

export interface PlayAction {
  id: string;
  kind: "enter" | "transition" | "return";
  label: string;
  /** Target beat title for transitions. */
  target: string;
  condition: string;
  enabled: boolean;
  edgeId?: string;
}

export function createPlayState(
  project: ProjectDocument,
  graphs: Record<string, GraphDocument>,
): PlayState {
  const values = defaultValues(project.variables);
  const root = graphs[project.rootGraphId];
  if (!root) return { frames: [], values, log: [], choosingGraphId: null };
  return enterGraph({ frames: [], values, log: [], choosingGraphId: null }, root);
}

/** Waits so any beat in the graph can be entered. Beats with no incoming edge are the suggested ones. */
function enterGraph(state: PlayState, graph: GraphDocument): PlayState {
  return { ...state, choosingGraphId: graph.id };
}

export function chooseStart(
  state: PlayState,
  graphs: Record<string, GraphDocument>,
  nodeId: string,
  variables: VariableDef[],
): PlayState {
  if (!state.choosingGraphId) return state;
  const graph = graphs[state.choosingGraphId];
  const node = graph?.nodes.find((item) => item.id === nodeId);
  if (!graph || !node) return state;
  return {
    ...state,
    frames: [...state.frames, { graphId: graph.id, nodeId: node.id }],
    values: applyEffects(state.values, node.effects, variables),
    log: [...state.log, beatLabel(node)],
    choosingGraphId: null,
  };
}

export function suggestedNodes(graph: GraphDocument): StoryNode[] {
  const entries = new Set(entryNodes(graph).map((node) => node.id));
  return [...graph.nodes].sort((a, b) => Number(entries.has(b.id)) - Number(entries.has(a.id)) || 0);
}

export function playLocation(
  state: PlayState,
  graphs: Record<string, GraphDocument>,
): { graph: GraphDocument; node: StoryNode } | null {
  const frame = state.frames[state.frames.length - 1];
  if (!frame) return null;
  const graph = graphs[frame.graphId];
  const node = graph?.nodes.find((item) => item.id === frame.nodeId);
  if (!graph || !node) return null;
  return { graph, node };
}

/** Ways forward from the current beat: its sub-graph, its outgoing transitions, and the way back up. */
export function availableActions(
  state: PlayState,
  project: ProjectDocument,
  graphs: Record<string, GraphDocument>,
): PlayAction[] {
  if (state.choosingGraphId) return [];
  const location = playLocation(state, graphs);
  if (!location) return [];
  const { graph, node } = location;
  const actions: PlayAction[] = [];

  if (node.subgraphId && graphs[node.subgraphId]) {
    const child = graphs[node.subgraphId];
    actions.push({
      id: `enter:${node.id}`,
      kind: "enter",
      label: "Step in",
      target: child.name.trim() || beatLabel(node, project),
      condition: "",
      enabled: true,
    });
  }

  for (const edge of graph.edges) {
    if (edge.source !== node.id) continue;
    const target = graph.nodes.find((item) => item.id === edge.target);
    const targetTitle = target ? beatLabel(target, project) : "Missing beat";
    actions.push({
      id: `edge:${edge.id}`,
      kind: "transition",
      label: edge.label || targetTitle,
      target: targetTitle,
      condition: edge.condition ? describeCondition(edge.condition, project) : "",
      enabled: evaluateCondition(edge.condition, state.values, project.variables),
      edgeId: edge.id,
    });
  }

  if (state.frames.length > 1) {
    const parent = state.frames[state.frames.length - 2];
    const parentNode = graphs[parent.graphId]?.nodes.find((item) => item.id === parent.nodeId);
    actions.push({
      id: "return",
      kind: "return",
      label: "Return",
      target: parentNode ? beatLabel(parentNode, project) : "Parent beat",
      condition: "",
      enabled: true,
    });
  }

  return actions;
}

export function performAction(
  state: PlayState,
  action: PlayAction,
  project: ProjectDocument,
  graphs: Record<string, GraphDocument>,
): PlayState {
  const fresh = availableActions(state, project, graphs).find((item) => item.id === action.id);
  if (!fresh?.enabled) return state;
  const location = playLocation(state, graphs);
  if (!location) return state;
  const { graph, node } = location;

  if (fresh.kind === "enter" && node.subgraphId) {
    const child = graphs[node.subgraphId];
    if (!child) return state;
    return enterGraph(state, child);
  }

  if (fresh.kind === "return") {
    if (state.frames.length <= 1) return state;
    return { ...state, frames: state.frames.slice(0, -1) };
  }

  if (fresh.kind === "transition" && fresh.edgeId) {
    const edge = graph.edges.find((item) => item.id === fresh.edgeId);
    const target = edge ? graph.nodes.find((item) => item.id === edge.target) : undefined;
    if (!edge || !target) return state;
    const frames = state.frames.slice(0, -1);
    frames.push({ graphId: graph.id, nodeId: target.id });
    return {
      frames,
      values: applyEffects(state.values, target.effects, project.variables),
      log: [...state.log, beatLabel(target, project)],
      choosingGraphId: null,
    };
  }

  return state;
}

export function setPlayValue(state: PlayState, variableId: string, value: VariableValue): PlayState {
  return { ...state, values: { ...state.values, [variableId]: value } };
}
