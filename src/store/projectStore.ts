import { create } from "zustand";
import {
  createTauriFs,
  errorMessage,
  inTauri,
  pickDirectory,
  pickSaveFile,
  sampleProjectDir,
} from "../desktop/tauri";
import { opsForVariable } from "../domain/effects";
import {
  createCategory,
  createEdge,
  createEffect,
  createGraph,
  createLine,
  createNode,
  createTag,
  createVariable,
  moveItem,
} from "../domain/factories";
import { descendantGraphIds } from "../domain/graphOps";
import {
  bundleProject,
  createNewProject,
  loadProject,
  saveProject,
  slugify,
  type ProjectFs,
} from "../domain/project";
import { createPlayState, performAction, setPlayValue, type PlayAction, type PlayState } from "../domain/play";
import { exportScreenplay } from "../domain/screenplay";
import { stringifyDoc } from "../domain/schema";
import { exportVoiceSheets } from "../domain/voices";
import type {
  DialogueLine,
  Effect,
  GraphDocument,
  ProjectDocument,
  Scalar,
  StoryEdge,
  StoryNode,
  StoryNodeType,
  Tag,
  TagCategory,
  VariableDef,
} from "../domain/types";
import { PROJECT_FILE } from "../domain/types";
import { joinPath } from "../domain/paths";

const RECENTS_KEY = "storyplanner.recents.v1";

export interface RecentProject {
  name: string;
  path: string;
  openedAt: string;
}

export type Selection = { kind: "node" | "edge"; id: string } | null;
export type Screen = "graph" | "play";
export type ResumeIntent = "new" | "open" | null;
export type ExportKind = "bundle" | "screenplay" | "voices";

export interface Banner {
  tone: "info" | "error";
  text: string;
}

interface ProjectStore {
  project: ProjectDocument | null;
  graphs: Record<string, GraphDocument>;
  projectPath: string | null;
  dirty: boolean;
  screen: Screen;
  currentGraphId: string | null;
  selection: Selection;
  exportOpen: boolean;
  recents: RecentProject[];
  play: PlayState | null;
  banner: Banner | null;
  busy: boolean;
  pendingClose: boolean;
  resumeIntent: ResumeIntent;
  ready: boolean;

  init: () => void;
  dismissBanner: () => void;
  setScreen: (screen: Screen) => void;
  setExportOpen: (open: boolean) => void;
  createNamedProject: (name: string) => Promise<void>;
  openFromDialog: () => Promise<void>;
  openAt: (folder: string) => Promise<boolean>;
  openSample: () => Promise<void>;
  save: () => Promise<boolean>;
  closeProject: () => void;
  requestClose: (intent?: ResumeIntent) => void;
  cancelClose: () => void;
  discardAndClose: () => void;
  saveAndClose: () => Promise<void>;

  renameProject: (name: string) => void;
  openGraph: (graphId: string) => void;
  select: (selection: Selection) => void;
  updateGraphMeta: (patch: Partial<Pick<GraphDocument, "name" | "sceneNotes">>) => void;
  updateNode: (nodeId: string, patch: Partial<StoryNode>) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  addNode: (type: StoryNodeType, position?: { x: number; y: number }) => void;
  deleteNodes: (nodeIds: string[]) => void;
  deleteEdges: (edgeIds: string[]) => void;
  connectNodes: (source: string, target: string) => void;
  updateEdge: (edgeId: string, patch: Partial<StoryEdge>) => void;
  moveEdge: (edgeId: string, direction: -1 | 1) => void;
  openSubgraph: (nodeId: string) => void;
  deleteSubgraph: (nodeId: string) => void;

  addLine: (nodeId: string) => void;
  updateLine: (nodeId: string, lineId: string, patch: Partial<DialogueLine>) => void;
  deleteLine: (nodeId: string, lineId: string) => void;
  moveLine: (nodeId: string, lineId: string, direction: -1 | 1) => void;

  addEdgeEffect: (edgeId: string) => void;
  updateEdgeEffect: (edgeId: string, effectId: string, patch: Partial<Effect>) => void;
  deleteEdgeEffect: (edgeId: string, effectId: string) => void;

  addVariable: (kind: string) => void;
  updateVariable: (variableId: string, patch: Partial<VariableDef>) => void;
  deleteVariable: (variableId: string) => void;
  addCategory: () => void;
  updateCategory: (categoryId: string, patch: Partial<TagCategory>) => void;
  deleteCategory: (categoryId: string) => void;
  addTag: (categoryId: string, name: string) => string | null;
  updateTag: (categoryId: string, tagId: string, patch: Partial<Tag>) => void;
  deleteTag: (categoryId: string, tagId: string) => void;
  ensureCharacterCategory: () => string | null;

  restartPlay: () => void;
  performPlay: (action: PlayAction) => void;
  updatePlayValue: (variableId: string, value: Scalar) => void;
  exportText: (kind: ExportKind) => string;
  exportToFile: (kind: ExportKind) => Promise<void>;
}

let filesystem: ProjectFs | null = null;

function fs(): ProjectFs {
  if (!inTauri()) {
    throw new Error("Project folders need the StoryPlanner desktop window. Run npm run tauri dev.");
  }
  filesystem ??= createTauriFs();
  return filesystem;
}

function remember(path: string, name: string, current: RecentProject[]): RecentProject[] {
  const recents = [
    { name, path, openedAt: new Date().toISOString() },
    ...current.filter((item) => item.path !== path),
  ].slice(0, 8);
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
  } catch {
    // The recent list is a convenience. A full disk should not block the project.
  }
  return recents;
}

function readRecents(): RecentProject[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentProject[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.path === "string" && typeof item.name === "string");
  } catch {
    return [];
  }
}

function withGraph(update: (graph: GraphDocument) => GraphDocument) {
  useProjectStore.setState((state) => {
    if (!state.currentGraphId) return {};
    const graph = state.graphs[state.currentGraphId];
    if (!graph) return {};
    return {
      graphs: { ...state.graphs, [state.currentGraphId]: update(graph) },
      dirty: true,
    };
  });
}

function withNode(nodeId: string, update: (node: StoryNode) => StoryNode) {
  withGraph((graph) => ({
    ...graph,
    nodes: graph.nodes.map((node) => (node.id === nodeId ? update(node) : node)),
  }));
}

function withEdge(edgeId: string, update: (edge: StoryEdge) => StoryEdge) {
  withGraph((graph) => ({
    ...graph,
    edges: graph.edges.map((edge) => (edge.id === edgeId ? update(edge) : edge)),
  }));
}

function blankEffect(variables: VariableDef[]): Effect {
  const variable = variables[0];
  const op = variable ? opsForVariable(variable.kind)[0] : "set";
  let value: Scalar = null;
  if (variable?.kind === "boolean") value = true;
  else if (variable?.kind === "value") value = op === "add" ? 1 : 0;
  else if (variable?.kind === "tag") {
    const category = useProjectStore.getState().project?.tagCategories.find((item) => item.id === variable.tagCategoryId);
    value = category?.tags[0]?.id ?? null;
  }
  return createEffect({ variableId: variable?.id ?? "", op, value });
}

function cleared(): Partial<ProjectStore> {
  return {
    project: null,
    graphs: {},
    projectPath: null,
    dirty: false,
    screen: "graph",
    currentGraphId: null,
    selection: null,
    exportOpen: false,
    play: null,
    pendingClose: false,
    banner: null,
  };
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  graphs: {},
  projectPath: null,
  dirty: false,
  screen: "graph",
  currentGraphId: null,
  selection: null,
  exportOpen: false,
  recents: [],
  play: null,
  banner: null,
  busy: false,
  pendingClose: false,
  resumeIntent: null,
  ready: false,

  init() {
    if (get().ready) return;
    set({ ready: true, recents: readRecents() });
  },

  dismissBanner() {
    set({ banner: null });
  },

  setScreen(screen) {
    const state = get();
    const play =
      screen === "play" && !state.play && state.project
        ? createPlayState(state.project, state.graphs)
        : state.play;
    set({ screen, play, exportOpen: false });
  },

  setExportOpen(open) {
    set({ exportOpen: open });
  },

  async createNamedProject(name) {
    const trimmed = name.trim() || "Untitled story";
    set({ busy: true, banner: null });
    try {
      const parent = await pickDirectory("Choose where to create the project");
      if (!parent) return;
      const folder = joinPath(parent, slugify(trimmed));
      const files = fs();
      if (await files.exists(joinPath(folder, PROJECT_FILE))) {
        throw new Error("That folder already contains a StoryPlanner project.");
      }
      const created = createNewProject(trimmed);
      const saved = await saveProject(files, folder, created.project, created.graphs);
      set({
        project: saved,
        graphs: created.graphs,
        projectPath: folder,
        dirty: false,
        screen: "graph",
        currentGraphId: saved.rootGraphId,
        selection: null,
        play: null,
        recents: remember(folder, saved.name, get().recents),
        banner: null,
      });
    } catch (error) {
      set({ banner: { tone: "error", text: errorMessage(error) } });
    } finally {
      set({ busy: false });
    }
  },

  async openFromDialog() {
    set({ busy: true, banner: null });
    try {
      const folder = await pickDirectory("Open a StoryPlanner project");
      if (!folder) return;
      await get().openAt(folder);
    } catch (error) {
      set({ banner: { tone: "error", text: errorMessage(error) } });
    } finally {
      set({ busy: false });
    }
  },

  async openAt(folder) {
    set({ busy: true, banner: null });
    try {
      const loaded = await loadProject(fs(), folder);
      set({
        project: loaded.project,
        graphs: loaded.graphs,
        projectPath: folder,
        dirty: false,
        screen: "graph",
        currentGraphId: loaded.project.rootGraphId,
        selection: null,
        play: null,
        exportOpen: false,
        recents: remember(folder, loaded.project.name, get().recents),
        banner: null,
      });
      return true;
    } catch (error) {
      set({ banner: { tone: "error", text: errorMessage(error) } });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  async openSample() {
    set({ busy: true, banner: null });
    try {
      const folder = await sampleProjectDir();
      await get().openAt(folder);
    } catch (error) {
      set({ banner: { tone: "error", text: errorMessage(error) } });
    } finally {
      set({ busy: false });
    }
  },

  async save() {
    const state = get();
    if (!state.project || !state.projectPath) return false;
    set({ busy: true });
    try {
      const saved = await saveProject(fs(), state.projectPath, state.project, state.graphs);
      set({
        project: saved,
        dirty: false,
        recents: remember(state.projectPath, saved.name, get().recents),
        banner: null,
      });
      return true;
    } catch (error) {
      set({ banner: { tone: "error", text: errorMessage(error) } });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  closeProject() {
    set((state) => ({ ...cleared(), recents: state.recents, resumeIntent: state.resumeIntent, ready: true }));
  },

  requestClose(intent = null) {
    if (!get().project) {
      set({ resumeIntent: intent });
      return;
    }
    if (!get().dirty) {
      set({ resumeIntent: intent });
      get().closeProject();
      return;
    }
    set({ pendingClose: true, resumeIntent: intent });
  },

  cancelClose() {
    set({ pendingClose: false, resumeIntent: null });
  },

  discardAndClose() {
    get().closeProject();
  },

  async saveAndClose() {
    const ok = await get().save();
    if (ok) get().closeProject();
  },

  renameProject(name) {
    set((state) => (state.project ? { project: { ...state.project, name }, dirty: true } : {}));
  },

  openGraph(graphId) {
    if (!get().graphs[graphId]) return;
    set({ currentGraphId: graphId, selection: null, screen: "graph" });
  },

  select(selection) {
    set({ selection });
  },

  updateGraphMeta(patch) {
    withGraph((graph) => ({ ...graph, ...patch }));
  },

  updateNode(nodeId, patch) {
    withNode(nodeId, (node) => ({ ...node, ...patch, id: node.id, type: node.type }));
  },

  updateNodePosition(nodeId, position) {
    withNode(nodeId, (node) => ({ ...node, position }));
  },

  addNode(type, position) {
    const state = get();
    const graph = state.currentGraphId ? state.graphs[state.currentGraphId] : undefined;
    if (!graph) return;
    if (type === "start" && graph.nodes.some((node) => node.type === "start")) {
      set({ banner: { tone: "error", text: "This graph already has a start." } });
      return;
    }
    const maxX = graph.nodes.reduce((max, node) => Math.max(max, node.position.x), 0);
    const node = createNode(type, { position: position ?? { x: maxX + 280, y: 140 + (graph.nodes.length % 4) * 48 } });
    withGraph((current) => ({ ...current, nodes: [...current.nodes, node] }));
    set({ selection: { kind: "node", id: node.id } });
  },

  deleteNodes(nodeIds) {
    const remove = new Set(nodeIds);
    useProjectStore.setState((state) => {
      if (!state.currentGraphId) return {};
      const graph = state.graphs[state.currentGraphId];
      if (!graph) return {};
      const graphs = { ...state.graphs };
      for (const node of graph.nodes) {
        if (remove.has(node.id) && node.subgraphId) {
          for (const id of descendantGraphIds(graphs, node.subgraphId)) delete graphs[id];
        }
      }
      const nextGraph = {
        ...graph,
        nodes: graph.nodes.filter((node) => !remove.has(node.id)),
        edges: graph.edges.filter((edge) => !remove.has(edge.source) && !remove.has(edge.target)),
      };
      graphs[state.currentGraphId] = nextGraph;
      let selection = state.selection;
      if (selection?.kind === "node" && remove.has(selection.id)) selection = null;
      if (selection?.kind === "edge" && !nextGraph.edges.some((edge) => edge.id === selection?.id)) {
        selection = null;
      }
      return { graphs, selection, dirty: true };
    });
  },

  deleteEdges(edgeIds) {
    const remove = new Set(edgeIds);
    withGraph((graph) => ({ ...graph, edges: graph.edges.filter((edge) => !remove.has(edge.id)) }));
    set((state) =>
      state.selection?.kind === "edge" && remove.has(state.selection.id) ? { selection: null } : {},
    );
  },

  connectNodes(source, target) {
    if (!source || !target || source === target) return;
    const edge = createEdge(source, target);
    withGraph((graph) => ({ ...graph, edges: [...graph.edges, edge] }));
    set({ selection: { kind: "edge", id: edge.id } });
  },

  updateEdge(edgeId, patch) {
    withEdge(edgeId, (edge) => ({ ...edge, ...patch, id: edge.id }));
  },

  moveEdge(edgeId, direction) {
    withGraph((graph) => {
      const edge = graph.edges.find((item) => item.id === edgeId);
      if (!edge) return graph;
      const siblings = graph.edges.filter((item) => item.source === edge.source);
      const index = siblings.indexOf(edge);
      const swap = siblings[index + direction];
      if (!swap) return graph;
      const edges = graph.edges.slice();
      const a = edges.indexOf(edge);
      const b = edges.indexOf(swap);
      edges[a] = swap;
      edges[b] = edge;
      return { ...graph, edges };
    });
  },

  openSubgraph(nodeId) {
    const state = get();
    if (!state.currentGraphId || !state.project) return;
    const graph = state.graphs[state.currentGraphId];
    const node = graph?.nodes.find((item) => item.id === nodeId);
    if (!graph || !node) return;
    if (node.subgraphId && state.graphs[node.subgraphId]) {
      set({ currentGraphId: node.subgraphId, selection: null, screen: "graph" });
      return;
    }
    const child = createGraph({
      name: node.title || "Inner graph",
      parentGraphId: graph.id,
      parentNodeId: node.id,
    });
    const start = createNode("start", { title: "Start", position: { x: 80, y: 200 } });
    const innerType = node.type === "dialogue" ? "dialogue" : "event";
    const inner = createNode(innerType, {
      title: innerType === "dialogue" ? "Dialogue" : "Beat",
      position: { x: 380, y: 170 },
    });
    child.nodes = [start, inner];
    child.edges = [createEdge(start.id, inner.id)];
    withNode(nodeId, (current) => ({ ...current, subgraphId: child.id }));
    set((current) => ({
      graphs: { ...current.graphs, [child.id]: child },
      currentGraphId: child.id,
      selection: null,
      screen: "graph",
      dirty: true,
    }));
  },

  deleteSubgraph(nodeId) {
    useProjectStore.setState((state) => {
      if (!state.currentGraphId) return {};
      const graph = state.graphs[state.currentGraphId];
      const node = graph?.nodes.find((item) => item.id === nodeId);
      if (!graph || !node?.subgraphId) return {};
      const graphs = { ...state.graphs };
      for (const id of descendantGraphIds(graphs, node.subgraphId)) delete graphs[id];
      graphs[graph.id] = {
        ...graph,
        nodes: graph.nodes.map((item) => (item.id === nodeId ? { ...item, subgraphId: null } : item)),
      };
      return { graphs, dirty: true };
    });
  },

  addLine(nodeId) {
    const speaker = get().project?.tagCategories.find((category) => category.isCharacters)?.tags[0]?.id ?? null;
    withNode(nodeId, (node) => ({ ...node, lines: [...node.lines, createLine({ speakerTagId: speaker })] }));
  },

  updateLine(nodeId, lineId, patch) {
    withNode(nodeId, (node) => ({
      ...node,
      lines: node.lines.map((line) => (line.id === lineId ? { ...line, ...patch, id: line.id } : line)),
    }));
  },

  deleteLine(nodeId, lineId) {
    withNode(nodeId, (node) => ({ ...node, lines: node.lines.filter((line) => line.id !== lineId) }));
  },

  moveLine(nodeId, lineId, direction) {
    withNode(nodeId, (node) => {
      const index = node.lines.findIndex((line) => line.id === lineId);
      return { ...node, lines: moveItem(node.lines, index, direction) };
    });
  },

  addEdgeEffect(edgeId) {
    const effect = blankEffect(get().project?.variables ?? []);
    withEdge(edgeId, (edge) => ({ ...edge, effects: [...edge.effects, effect] }));
  },

  updateEdgeEffect(edgeId, effectId, patch) {
    withEdge(edgeId, (edge) => ({
      ...edge,
      effects: edge.effects.map((effect) => (effect.id === effectId ? { ...effect, ...patch, id: effect.id } : effect)),
    }));
  },

  deleteEdgeEffect(edgeId, effectId) {
    withEdge(edgeId, (edge) => ({ ...edge, effects: edge.effects.filter((effect) => effect.id !== effectId) }));
  },

  addVariable(kind) {
    set((state) => {
      if (!state.project) return {};
      const count = state.project.variables.filter((variable) => variable.kind === kind).length + 1;
      const base = kind === "boolean" ? "flag" : kind === "value" ? "amount" : kind === "tag" ? "label" : "variable";
      const variable = createVariable(kind, {
        name: `${base}${count}`,
        tagCategoryId: kind === "tag" ? state.project.tagCategories[0]?.id ?? null : null,
      });
      return { project: { ...state.project, variables: [...state.project.variables, variable] }, dirty: true };
    });
  },

  updateVariable(variableId, patch) {
    set((state) => {
      if (!state.project) return {};
      return {
        project: {
          ...state.project,
          variables: state.project.variables.map((variable) =>
            variable.id === variableId ? { ...variable, ...patch, id: variable.id } : variable,
          ),
        },
        dirty: true,
      };
    });
  },

  deleteVariable(variableId) {
    set((state) => {
      if (!state.project) return {};
      return {
        project: {
          ...state.project,
          variables: state.project.variables.filter((variable) => variable.id !== variableId),
        },
        dirty: true,
      };
    });
  },

  addCategory() {
    set((state) => {
      if (!state.project) return {};
      return {
        project: { ...state.project, tagCategories: [...state.project.tagCategories, createCategory()] },
        dirty: true,
      };
    });
  },

  updateCategory(categoryId, patch) {
    set((state) => {
      if (!state.project) return {};
      return {
        project: {
          ...state.project,
          tagCategories: state.project.tagCategories.map((category) =>
            category.id === categoryId ? { ...category, ...patch, id: category.id, tags: patch.tags ?? category.tags } : category,
          ),
        },
        dirty: true,
      };
    });
  },

  deleteCategory(categoryId) {
    set((state) => {
      if (!state.project) return {};
      return {
        project: {
          ...state.project,
          tagCategories: state.project.tagCategories.filter((category) => category.id !== categoryId),
          variables: state.project.variables.map((variable) =>
            variable.tagCategoryId === categoryId ? { ...variable, tagCategoryId: null } : variable,
          ),
        },
        dirty: true,
      };
    });
  },

  addTag(categoryId, name) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    let created: string | null = null;
    set((state) => {
      if (!state.project) return {};
      const categories = state.project.tagCategories.map((category) => {
        if (category.id !== categoryId) return category;
        const tag = createTag(trimmed, category.tags.length);
        created = tag.id;
        return { ...category, tags: [...category.tags, tag] };
      });
      if (!created) return {};
      return { project: { ...state.project, tagCategories: categories }, dirty: true };
    });
    return created;
  },

  updateTag(categoryId, tagId, patch) {
    set((state) => {
      if (!state.project) return {};
      return {
        project: {
          ...state.project,
          tagCategories: state.project.tagCategories.map((category) =>
            category.id === categoryId
              ? {
                  ...category,
                  tags: category.tags.map((tag) => (tag.id === tagId ? { ...tag, ...patch, id: tag.id } : tag)),
                }
              : category,
          ),
        },
        dirty: true,
      };
    });
  },

  deleteTag(categoryId, tagId) {
    set((state) => {
      if (!state.project) return {};
      return {
        project: {
          ...state.project,
          tagCategories: state.project.tagCategories.map((category) =>
            category.id === categoryId
              ? { ...category, tags: category.tags.filter((tag) => tag.id !== tagId) }
              : category,
          ),
        },
        dirty: true,
      };
    });
  },

  ensureCharacterCategory() {
    const project = get().project;
    if (!project) return null;
    const existing = project.tagCategories.find((category) => category.isCharacters);
    if (existing) return existing.id;
    const category = createCategory({
      name: "Characters",
      isCharacters: true,
      description: "People who can speak dialogue.",
    });
    set({ project: { ...project, tagCategories: [...project.tagCategories, category] }, dirty: true });
    return category.id;
  },

  restartPlay() {
    const state = get();
    if (!state.project) return;
    set({ play: createPlayState(state.project, state.graphs) });
  },

  performPlay(action) {
    const state = get();
    if (!state.play || !state.project) return;
    set({ play: performAction(state.play, action, state.project, state.graphs) });
  },

  updatePlayValue(variableId, value) {
    const play = get().play;
    if (!play) return;
    set({ play: setPlayValue(play, variableId, value) });
  },

  exportText(kind) {
    const state = get();
    if (!state.project) return "";
    if (kind === "bundle") {
      return stringifyDoc(bundleProject(state.project, state.graphs, new Date().toISOString()));
    }
    if (kind === "screenplay") return exportScreenplay(state.project, state.graphs);
    return exportVoiceSheets(state.project, state.graphs);
  },

  async exportToFile(kind) {
    const state = get();
    if (!state.project) return;
    const slug = slugify(state.project.name);
    const extension = kind === "bundle" ? "json" : "md";
    const filename =
      kind === "bundle" ? `${slug}.json` : kind === "screenplay" ? `${slug}-screenplay.md` : `${slug}-voices.md`;
    set({ busy: true });
    try {
      const target = await pickSaveFile("Export", filename, extension);
      if (!target) return;
      await fs().writeText(target, get().exportText(kind));
      set({ banner: { tone: "info", text: "Export saved." } });
    } catch (error) {
      set({ banner: { tone: "error", text: errorMessage(error) } });
    } finally {
      set({ busy: false });
    }
  },
}));
