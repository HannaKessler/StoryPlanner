import { describeCondition, evaluateCondition } from "./conditions";
import { applyEffects, defaultValues } from "./effects";
import { findEntryNode } from "./graphOps";
import type {
  GraphDocument,
  ProjectDocument,
  Scalar,
  StoryEdge,
  StoryNode,
} from "./types";

export interface PlayFrame {
  graphId: string;
  nodeId: string;
  spentChoiceIds: string[];
}

export interface PlayState {
  frames: PlayFrame[];
  values: Record<string, Scalar>;
  /** Titles of beats entered, in order. */
  log: string[];
}

export interface PlayAction {
  id: string;
  kind: "enter" | "choice" | "edge" | "return";
  label: string;
  detail: string;
  enabled: boolean;
  reason: string;
  choiceId?: string;
  edgeId?: string;
}

export function createPlayState(
  project: ProjectDocument,
  graphs: Record<string, GraphDocument>,
): PlayState {
  const root = graphs[project.rootGraphId];
  const entry = root ? findEntryNode(root) : null;
  if (!root || !entry) {
    return { frames: [], values: defaultValues(project.variables), log: [] };
  }
  return {
    frames: [{ graphId: root.id, nodeId: entry.id, spentChoiceIds: [] }],
    values: applyEffects(defaultValues(project.variables), entry.effects, project.variables),
    log: [entry.title || "Untitled"],
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

export function availableActions(
  state: PlayState,
  project: ProjectDocument,
  graphs: Record<string, GraphDocument>,
): PlayAction[] {
  const location = playLocation(state, graphs);
  if (!location) return [];
  const frame = state.frames[state.frames.length - 1];
  const { graph, node } = location;
  const actions: PlayAction[] = [];

  if (node.subgraphId && graphs[node.subgraphId]) {
    const child = graphs[node.subgraphId];
    actions.push({
      id: `enter:${node.id}`,
      kind: "enter",
      label: `Step into ${node.title || "this beat"}`,
      detail: child.name ? `Inner graph “${child.name}”` : "Open the inner graph",
      enabled: true,
      reason: "",
    });
  }

  for (const choice of node.choices) {
    const edge = graph.edges.find((item) => item.choiceId === choice.id && item.source === node.id);
    const spent = frame.spentChoiceIds.includes(choice.id);
    const choiceOk = evaluateCondition(choice.condition, state.values, project.variables);
    const edgeOk = edge ? evaluateCondition(edge.condition, state.values, project.variables) : true;
    const enabled = choiceOk && edgeOk && !spent;
    let reason = "";
    if (spent) reason = "Already taken";
    else if (!choiceOk) reason = describeCondition(choice.condition, project);
    else if (!edgeOk && edge) reason = describeCondition(edge.condition, project);
    actions.push({
      id: `choice:${choice.id}`,
      kind: "choice",
      label: choice.label || "Untitled choice",
      detail: edge
        ? describeCondition(choice.condition, project)
        : "Not connected yet — effects still apply",
      enabled,
      reason,
      choiceId: choice.id,
      edgeId: edge?.id,
    });
  }

  for (const edge of graph.edges) {
    if (edge.source !== node.id || edge.choiceId) continue;
    const target = graph.nodes.find((item) => item.id === edge.target);
    const enabled = evaluateCondition(edge.condition, state.values, project.variables);
    actions.push({
      id: `edge:${edge.id}`,
      kind: "edge",
      label: edge.label || target?.title || "Continue",
      detail: describeCondition(edge.condition, project),
      enabled,
      reason: enabled ? "" : describeCondition(edge.condition, project),
      edgeId: edge.id,
    });
  }

  if (state.frames.length > 1) {
    actions.push({
      id: "return",
      kind: "return",
      label: "Return",
      detail: "Back to the beat that contains this graph",
      enabled: true,
      reason: "",
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
    const entry = child ? findEntryNode(child) : null;
    if (!child || !entry) return state;
    return pushFrame(state, child.id, entry, project);
  }

  if (fresh.kind === "return") {
    if (state.frames.length <= 1) return state;
    return { ...state, frames: state.frames.slice(0, -1) };
  }

  if (fresh.kind === "choice" && fresh.choiceId) {
    const choice = node.choices.find((item) => item.id === fresh.choiceId);
    if (!choice) return state;
    const withEffects: PlayState = {
      ...state,
      values: applyEffects(state.values, choice.effects, project.variables),
    };
    const edge = fresh.edgeId ? graph.edges.find((item) => item.id === fresh.edgeId) : undefined;
    if (!edge) {
      const frames = state.frames.slice();
      const top = { ...frames[frames.length - 1], spentChoiceIds: [...frames[frames.length - 1].spentChoiceIds, choice.id] };
      frames[frames.length - 1] = top;
      return { ...withEffects, frames };
    }
    return moveAlong(withEffects, graph, edge, project);
  }

  if (fresh.kind === "edge" && fresh.edgeId) {
    const edge = graph.edges.find((item) => item.id === fresh.edgeId);
    if (!edge) return state;
    return moveAlong(state, graph, edge, project);
  }

  return state;
}

export function setPlayValue(state: PlayState, variableId: string, value: Scalar): PlayState {
  return { ...state, values: { ...state.values, [variableId]: value } };
}

function moveAlong(
  state: PlayState,
  graph: GraphDocument,
  edge: StoryEdge,
  project: ProjectDocument,
): PlayState {
  const target = graph.nodes.find((item) => item.id === edge.target);
  if (!target) return state;
  return replaceTop(state, graph.id, target, project);
}

function replaceTop(
  state: PlayState,
  graphId: string,
  node: StoryNode,
  project: ProjectDocument,
): PlayState {
  const frames = state.frames.slice(0, -1);
  frames.push({ graphId, nodeId: node.id, spentChoiceIds: [] });
  return {
    frames,
    values: applyEffects(state.values, node.effects, project.variables),
    log: [...state.log, node.title || "Untitled"],
  };
}

function pushFrame(
  state: PlayState,
  graphId: string,
  node: StoryNode,
  project: ProjectDocument,
): PlayState {
  return {
    frames: [...state.frames, { graphId, nodeId: node.id, spentChoiceIds: [] }],
    values: applyEffects(state.values, node.effects, project.variables),
    log: [...state.log, node.title || "Untitled"],
  };
}
