import { describeCondition, evaluateCondition, failingClause } from "./conditions";
import { applyEffects, defaultValues } from "./effects";
import { entryNodes } from "./graphOps";
import { beatLabel } from "./labels";
import type { GraphDocument, ProjectDocument, StoryNode, VariableDef, VariableValue } from "./types";

export interface PlayFrame {
  graphId: string;
  nodeId: string;
}

export interface PlaySnapshot {
  frames: PlayFrame[];
  values: Record<string, VariableValue>;
  /** Titles of beats entered, in order. */
  log: string[];
  /** For each log entry, how many steps had been taken right after it was entered. */
  marks: number[];
  /** When set, play is waiting for a beat to enter in this graph. */
  choosingGraphId: string | null;
}

export interface PlayState extends PlaySnapshot {
  /** Earlier states, oldest first. One per step taken. */
  history: PlaySnapshot[];
}

export interface PlayAction {
  id: string;
  kind: "enter" | "transition" | "return";
  label: string;
  /** Target beat title for transitions. */
  target: string;
  condition: string;
  /** First clause that blocks a disabled transition. */
  failed: string;
  enabled: boolean;
  edgeId?: string;
}

export function createPlayState(
  project: ProjectDocument,
  graphs: Record<string, GraphDocument>,
): PlayState {
  const values = defaultValues(project.variables);
  const empty: PlayState = { frames: [], values, log: [], marks: [], choosingGraphId: null, history: [] };
  const root = graphs[project.rootGraphId];
  if (!root) return empty;
  return enterGraph(empty, root);
}

function snapshot(state: PlayState): PlaySnapshot {
  const { frames, values, log, marks, choosingGraphId } = state;
  return { frames, values, log, marks, choosingGraphId };
}

/** Records the current state so the step being taken can be undone. */
function step(state: PlayState, next: PlaySnapshot, entered?: string): PlayState {
  const history = [...state.history, snapshot(state)];
  if (entered === undefined) return { ...next, history };
  return { ...next, history, log: [...next.log, entered], marks: [...next.marks, history.length] };
}

export function stepBack(state: PlayState): PlayState {
  const previous = state.history.at(-1);
  if (!previous) return state;
  return { ...previous, history: state.history.slice(0, -1) };
}

/** Returns to the moment a logged beat was entered. */
export function jumpTo(state: PlayState, index: number): PlayState {
  const mark = state.marks[index];
  if (mark === undefined || mark >= state.history.length) return state;
  return { ...state.history[mark], history: state.history.slice(0, mark) };
}

/** Keeps a play-through usable after the story was edited. Starts over when its place is gone. */
export function reconcilePlay(
  state: PlayState,
  project: ProjectDocument,
  graphs: Record<string, GraphDocument>,
): PlayState {
  const framesOk = state.frames.every((frame) => graphs[frame.graphId]?.nodes.some((node) => node.id === frame.nodeId));
  const choosingOk = !state.choosingGraphId || Boolean(graphs[state.choosingGraphId]);
  if (!framesOk || !choosingOk || (state.frames.length === 0 && !state.choosingGraphId)) {
    return createPlayState(project, graphs);
  }
  const defaults = defaultValues(project.variables);
  const values: Record<string, VariableValue> = {};
  let changed = Object.keys(state.values).length !== project.variables.length;
  for (const variable of project.variables) {
    if (variable.id in state.values && sameKind(state.values[variable.id], defaults[variable.id])) {
      values[variable.id] = state.values[variable.id];
    } else {
      values[variable.id] = defaults[variable.id];
      changed = true;
    }
  }
  if (!changed) return state;
  return { ...state, values, history: [], marks: state.marks.map(() => 0) };
}

function sameKind(a: VariableValue, b: VariableValue): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b);
  return typeof a === typeof b || a === null || b === null;
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
  return step(
    state,
    {
      ...snapshot(state),
      frames: [...state.frames, { graphId: graph.id, nodeId: node.id }],
      values: applyEffects(state.values, node.effects, variables),
      choosingGraphId: null,
    },
    beatLabel(node),
  );
}

/** Beats offered when play enters a graph. Inside a sub-graph, only its entry beats when it has any. */
export function startChoices(graph: GraphDocument, isRoot: boolean): StoryNode[] {
  if (isRoot) return suggestedNodes(graph);
  const entries = entryNodes(graph);
  return entries.length > 0 ? entries : graph.nodes;
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
      label: "Open",
      target: child.name.trim() || beatLabel(node, project),
      condition: "",
      failed: "",
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
      failed: failingClause(edge.condition, state.values, project),
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
      failed: "",
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
    return step(state, { ...snapshot(state), choosingGraphId: child.id });
  }

  if (fresh.kind === "return") {
    if (state.frames.length <= 1) return state;
    return step(state, { ...snapshot(state), frames: state.frames.slice(0, -1) });
  }

  if (fresh.kind === "transition" && fresh.edgeId) {
    const edge = graph.edges.find((item) => item.id === fresh.edgeId);
    const target = edge ? graph.nodes.find((item) => item.id === edge.target) : undefined;
    if (!edge || !target) return state;
    const frames = state.frames.slice(0, -1);
    frames.push({ graphId: graph.id, nodeId: target.id });
    return step(
      state,
      {
        ...snapshot(state),
        frames,
        values: applyEffects(state.values, target.effects, project.variables),
        choosingGraphId: null,
      },
      beatLabel(target, project),
    );
  }

  return state;
}

export function setPlayValue(state: PlayState, variableId: string, value: VariableValue): PlayState {
  return { ...state, values: { ...state.values, [variableId]: value } };
}
