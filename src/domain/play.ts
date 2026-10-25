import { describeCondition, evaluateCondition } from "./conditions";
import { applyEffects, defaultValues, describeEffect } from "./effects";
import { startNodes } from "./graphOps";
import { beatLabel } from "./labels";
import type { GraphDocument, ProjectDocument, Scalar, StoryNode } from "./types";

export interface PlayFrame {
  graphId: string;
  nodeId: string;
}

export interface PlayState {
  frames: PlayFrame[];
  values: Record<string, Scalar>;
  /** Titles of beats entered, in order. */
  log: string[];
  /**
   * When set, play is waiting for a start beat in this graph. One start is
   * entered immediately. Several starts wait here. None waits here too, so the
   * player can see that the graph has no start.
   */
  choosingGraphId: string | null;
}

export interface PlayAction {
  id: string;
  kind: "enter" | "transition" | "return";
  label: string;
  /** Target beat title for transitions. */
  target: string;
  condition: string;
  effects: string;
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

/** Enters the only start, or waits so the player can choose among several. */
function enterGraph(state: PlayState, graph: GraphDocument): PlayState {
  const starts = startNodes(graph);
  if (starts.length !== 1) return { ...state, choosingGraphId: graph.id };
  const entry = starts[0];
  return {
    ...state,
    frames: [...state.frames, { graphId: graph.id, nodeId: entry.id }],
    log: [...state.log, beatLabel(entry)],
    choosingGraphId: null,
  };
}

export function chooseStart(
  state: PlayState,
  graphs: Record<string, GraphDocument>,
  nodeId: string,
): PlayState {
  if (!state.choosingGraphId) return state;
  const graph = graphs[state.choosingGraphId];
  const node = graph?.nodes.find((item) => item.id === nodeId && item.type === "start");
  if (!graph || !node) return state;
  return {
    ...state,
    frames: [...state.frames, { graphId: graph.id, nodeId: node.id }],
    log: [...state.log, beatLabel(node)],
    choosingGraphId: null,
  };
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
      effects: "",
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
      effects: edge.effects.map((effect) => describeEffect(effect, project)).join(", "),
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
      effects: "",
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
      values: applyEffects(state.values, edge.effects, project.variables),
      log: [...state.log, beatLabel(target, project)],
      choosingGraphId: null,
    };
  }

  return state;
}

export function setPlayValue(state: PlayState, variableId: string, value: Scalar): PlayState {
  return { ...state, values: { ...state.values, [variableId]: value } };
}
