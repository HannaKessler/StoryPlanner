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
import { copyImagesIntoProject } from "../domain/assets";
import {
  createEdge,
  createEffect,
  createEntity,
  createGraph,
  createLine,
  createNode,
  createVariable,
  moveItem,
} from "../domain/factories";
import { entitiesOf, withEntities } from "../domain/format";
import { descendantGraphIds, splitTransition } from "../domain/graphOps";
import { isDuplicateName, newEntityName, uniqueName } from "../domain/names";
import {
  countEntityRefs,
  countVariableRefs,
  deleteEntity as deleteEntityEverywhere,
  deleteVariable as deleteVariableEverywhere,
  referencedImages,
  sanitizeReferences,
} from "../domain/references";
import {
  bundleProject,
  createNewProject,
  loadProject,
  saveProject,
  slugify,
  type ProjectFs,
} from "../domain/project";
import { chooseStart, createPlayState, performAction, setPlayValue, type PlayAction, type PlayState } from "../domain/play";
import { exportScreenplay } from "../domain/screenplay";
import { stringifyDoc } from "../domain/schema";
import { exportVoiceSheets } from "../domain/voices";
import type {
  DialogueLine,
  Effect,
  GraphDocument,
  LocationBox,
  EntityKind,
  ProjectDocument,
  Scalar,
  StoryEdge,
  StoryEntity,
  StoryNode,
  VariableDef,
  VariableValue,
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
export type Screen = "graph" | "play" | "characters" | "items" | "locations";
/** What to do once the project has closed. `quit` closes the window. */
export type ResumeIntent = "new" | "open" | "quit" | null;
export type ExportKind = "bundle" | "screenplay" | "voices";

/** A project state that undo and redo can return to. */
export interface Snapshot {
  project: ProjectDocument;
  graphs: Record<string, GraphDocument>;
  revision: number;
}

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}

export const HISTORY_LIMIT = 200;
/** Edits to the same text field closer together than this become one undo step. */
export const COALESCE_MS = 600;

export interface Banner {
  tone: "info" | "error";
  text: string;
}

interface ProjectStore {
  project: ProjectDocument | null;
  graphs: Record<string, GraphDocument>;
  projectPath: string | null;
  dirty: boolean;
  /** Identifies the current content. Every edit gets a new value. */
  revision: number;
  /** Revision last written to disk. */
  savedRevision: number;
  past: Snapshot[];
  future: Snapshot[];
  /** Bumped by undo and redo so the canvas also restores positions. */
  restoreTick: number;
  confirm: ConfirmRequest | null;
  screen: Screen;
  canvasMode: "graph" | "locations";
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
  setCanvasMode: (mode: "graph" | "locations") => void;
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
  undo: () => void;
  redo: () => void;
  resolveConfirm: (confirmed: boolean) => void;
  requestDeleteNodes: (nodeIds: string[], edgeIds?: string[]) => void;
  requestDeleteSubgraph: (nodeId: string) => void;
  requestDeleteVariable: (variableId: string) => void;
  requestDeleteEntity: (kind: EntityKind, entityId: string) => void;

  renameProject: (name: string) => void;
  openGraph: (graphId: string) => void;
  select: (selection: Selection) => void;
  updateGraphMeta: (patch: Partial<Pick<GraphDocument, "name" | "sceneNotes">>) => void;
  updateNode: (nodeId: string, patch: Partial<StoryNode>) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  saveLocationLayout: (patch: { box?: LocationBox; nodePositions?: Record<string, { x: number; y: number }> }) => void;
  addNode: (position?: { x: number; y: number }) => void;
  deleteNodes: (nodeIds: string[], edgeIds?: string[]) => void;
  deleteEdges: (edgeIds: string[]) => void;
  connectNodes: (source: string, target: string) => void;
  addConnectedNode: (sourceId: string, position: { x: number; y: number }) => void;
  addParallelTransition: (edgeId: string) => void;
  insertBeatOnEdge: (edgeId: string) => void;
  updateEdge: (edgeId: string, patch: Partial<StoryEdge>) => void;
  moveEdge: (edgeId: string, direction: -1 | 1) => void;
  openSubgraph: (nodeId: string) => void;
  createSubgraph: (nodeId: string) => void;
  deleteSubgraph: (nodeId: string) => void;

  addLine: (nodeId: string) => void;
  updateLine: (nodeId: string, lineId: string, patch: Partial<DialogueLine>) => void;
  deleteLine: (nodeId: string, lineId: string) => void;
  moveLine: (nodeId: string, lineId: string, direction: -1 | 1) => void;

  addNodeEffect: (nodeId: string) => void;
  updateNodeEffect: (nodeId: string, effectId: string, patch: Partial<Effect>) => void;
  deleteNodeEffect: (nodeId: string, effectId: string) => void;

  addVariable: (kind: string) => string | null;
  updateVariable: (variableId: string, patch: Partial<VariableDef>) => void;
  deleteVariable: (variableId: string) => void;
  addEntity: (kind: EntityKind, name?: string) => string | null;
  updateEntity: (kind: EntityKind, entityId: string, patch: Partial<Pick<StoryEntity, "name" | "notes" | "images" | "fields">>) => void;
  deleteEntity: (kind: EntityKind, entityId: string) => void;
  addEntityImages: (kind: EntityKind, entityId: string) => Promise<void>;
  removeEntityImage: (kind: EntityKind, entityId: string, path: string) => Promise<void>;

  restartPlay: () => void;
  beginPlay: (nodeId: string) => void;
  cancelStartChoice: () => void;
  performPlay: (action: PlayAction) => void;
  updatePlayValue: (variableId: string, value: VariableValue) => void;
  exportText: (kind: ExportKind) => string;
  exportToFile: (kind: ExportKind) => Promise<void>;
}

let filesystem: ProjectFs | null = null;
let saveInFlight: Promise<boolean> | null = null;

/** Tests and previews supply their own file system. */
export function setProjectFs(next: ProjectFs | null) {
  filesystem = next;
}

function fs(): ProjectFs {
  if (filesystem) return filesystem;
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

let revisionCounter = 0;

function nextRevision(): number {
  revisionCounter += 1;
  return revisionCounter;
}

/** Key of the text field the next edit types into. Consumed by the next state change. */
let pendingTypingKey: string | null = null;
let lastTyping: { key: string; at: number } | null = null;

/** Marks the next edit as typing so quick keystrokes in one field share an undo step. */
function typing(prefix: string, patch: object) {
  const values = Object.values(patch);
  if (values.length === 0 || !values.every((value) => typeof value === "string")) return;
  pendingTypingKey = `${prefix}:${Object.keys(patch).sort().join(",")}`;
}

type StoreState = ProjectStore;
type StatePatch = Partial<StoreState>;

/**
 * Runs on every state change. An edit to the project or its graphs gets a
 * new revision and pushes the previous content onto the undo stack. Changes
 * that set `revision` themselves (open, close, save, undo) are left alone.
 */
function trackHistory(prev: StoreState, patch: StatePatch): StatePatch {
  const key = pendingTypingKey;
  pendingTypingKey = null;
  if ("revision" in patch) {
    lastTyping = null;
    return patch;
  }
  const changed =
    ("project" in patch && patch.project !== prev.project) || ("graphs" in patch && patch.graphs !== prev.graphs);
  if (!changed || !prev.project) {
    if ("dirty" in patch) {
      const { dirty: _ignored, ...rest } = patch;
      return rest;
    }
    return patch;
  }
  const now = Date.now();
  const coalesce = key !== null && lastTyping?.key === key && now - lastTyping.at < COALESCE_MS && prev.past.length > 0;
  lastTyping = key ? { key, at: now } : null;
  const revision = nextRevision();
  const next: StatePatch = { ...patch, revision, dirty: revision !== prev.savedRevision, future: [] };
  if (!coalesce) {
    next.past = [...prev.past, { project: prev.project, graphs: prev.graphs, revision: prev.revision }].slice(-HISTORY_LIMIT);
  }
  return next;
}

/** Content just read from or written to disk. History starts empty. */
function freshContent(project: ProjectDocument, graphs: Record<string, GraphDocument>, clean = true): StatePatch {
  const revision = nextRevision();
  return {
    project,
    graphs,
    revision,
    savedRevision: clean ? revision : -1,
    dirty: !clean,
    past: [],
    future: [],
  };
}

/** Image files this session knows are on disk, and those the saved project uses. */
let diskImages = new Set<string>();
let savedImages = new Set<string>();

function resetImages(project: ProjectDocument | null) {
  savedImages = project ? referencedImages(project) : new Set();
  diskImages = new Set(savedImages);
}

function safeAsset(path: string): boolean {
  return Boolean(path) && !path.includes("..") && path.startsWith("assets/");
}

async function removeFiles(root: string, paths: Iterable<string>) {
  for (const path of paths) {
    if (!safeAsset(path)) continue;
    try {
      await fs().remove(joinPath(root, path));
    } catch {
      // A file that cannot be removed stays on disk. Nothing points at it.
    }
  }
}

/** After a save, removes images that neither the saved project, the live one, nor undo history uses. */
async function pruneImages(root: string, saved: ProjectDocument) {
  const state = useProjectStore.getState();
  const keep = referencedImages(saved);
  const projects = [state.project, ...state.past.map((item) => item.project), ...state.future.map((item) => item.project)];
  for (const project of projects) {
    if (!project) continue;
    for (const path of referencedImages(project)) keep.add(path);
  }
  const stale = [...diskImages].filter((path) => !keep.has(path));
  diskImages = new Set([...diskImages].filter((path) => keep.has(path)));
  savedImages = referencedImages(saved);
  await removeFiles(root, stale);
}

/** On discard, removes images copied in since the last save. */
async function discardImages(root: string | null) {
  const added = [...diskImages].filter((path) => !savedImages.has(path));
  diskImages = new Set(savedImages);
  if (root && added.length > 0) await removeFiles(root, added);
}

async function closeWindow() {
  if (!inTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().destroy();
}

function validSelection(selection: Selection, graph: GraphDocument | undefined): Selection {
  if (!selection || !graph) return null;
  if (selection.kind === "node") return graph.nodes.some((node) => node.id === selection.id) ? selection : null;
  return graph.edges.some((edge) => edge.id === selection.id) ? selection : null;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function restore(state: StoreState, target: Snapshot): StatePatch {
  lastTyping = null;
  const currentGraphId =
    state.currentGraphId && target.graphs[state.currentGraphId] ? state.currentGraphId : target.project.rootGraphId;
  return {
    project: target.project,
    graphs: target.graphs,
    revision: target.revision,
    dirty: target.revision !== state.savedRevision,
    currentGraphId,
    selection: validSelection(state.selection, target.graphs[currentGraphId]),
    restoreTick: state.restoreTick + 1,
    play: state.screen === "play" ? createPlayState(target.project, target.graphs) : null,
  };
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
  else if (variable && (variable.kind === "character" || variable.kind === "item" || variable.kind === "location" || variable.kind === "inventory")) {
    const project = useProjectStore.getState().project;
    const kind = variable.kind === "inventory" ? "item" : variable.kind;
    value = project ? entitiesOf(project, kind)[0]?.id ?? null : null;
  }
  return createEffect({ variableId: variable?.id ?? "", op, value });
}

function cleared(): Partial<ProjectStore> {
  return {
    project: null,
    graphs: {},
    projectPath: null,
    dirty: false,
    revision: nextRevision(),
    savedRevision: 0,
    past: [],
    future: [],
    confirm: null,
    screen: "graph",
    canvasMode: "graph",
    currentGraphId: null,
    selection: null,
    exportOpen: false,
    play: null,
    pendingClose: false,
    banner: null,
  };
}

export const useProjectStore = create<ProjectStore>()((_set, get, api) => {
  const baseSet = api.setState;
  const set = ((partial: StatePatch | ((state: StoreState) => StatePatch), replace?: boolean) => {
    const prev = api.getState();
    const patch = typeof partial === "function" ? partial(prev) : partial;
    (baseSet as (patch: StatePatch, replace?: boolean) => void)(trackHistory(prev, patch), replace);
  }) as typeof api.setState;
  api.setState = set;
  return {
  project: null,
  graphs: {},
  projectPath: null,
  dirty: false,
  revision: 0,
  savedRevision: 0,
  past: [],
  future: [],
  restoreTick: 0,
  confirm: null,
  screen: "graph",
  canvasMode: "graph",
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

  setCanvasMode(canvasMode) {
    set({ canvasMode });
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
      resetImages(saved);
      set({
        ...freshContent(saved, created.graphs),
        projectPath: folder,
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
      // References to deleted entities or variables are dropped. The project is then unsaved.
      const clean = sanitizeReferences(loaded.project, loaded.graphs);
      resetImages(loaded.project);
      set({
        ...freshContent(clean.project, clean.graphs, clean.count === 0),
        projectPath: folder,
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

  save() {
    // One save at a time. A second request while writing gets the running save.
    if (saveInFlight) return saveInFlight;
    const run = (async () => {
      const state = get();
      if (!state.project || !state.projectPath) return false;
      const snapshot = { project: state.project, graphs: state.graphs, revision: state.revision, path: state.projectPath };
      set({ busy: true });
      try {
        const saved = await saveProject(fs(), snapshot.path, snapshot.project, snapshot.graphs);
        const now = get();
        if (now.projectPath !== snapshot.path || now.project?.id !== snapshot.project.id) return true;
        const unchanged = now.revision === snapshot.revision;
        // Edits made while writing stay in place and stay unsaved.
        set({
          ...(unchanged ? { project: saved, revision: snapshot.revision } : {}),
          savedRevision: snapshot.revision,
          dirty: now.revision !== snapshot.revision,
          recents: remember(snapshot.path, saved.name, get().recents),
          banner: null,
        });
        await pruneImages(snapshot.path, saved);
        return true;
      } catch (error) {
        set({ banner: { tone: "error", text: errorMessage(error) } });
        return false;
      } finally {
        set({ busy: false });
      }
    })();
    saveInFlight = run;
    void run.finally(() => {
      if (saveInFlight === run) saveInFlight = null;
    });
    return run;
  },

  closeProject() {
    resetImages(null);
    lastTyping = null;
    set((state) => ({ ...cleared(), recents: state.recents, resumeIntent: state.resumeIntent, ready: true }));
    if (get().resumeIntent === "quit") {
      set({ resumeIntent: null });
      void closeWindow();
    }
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
    const root = get().projectPath;
    set({ pendingClose: false });
    void discardImages(root).finally(() => get().closeProject());
  },

  async saveAndClose() {
    // Edits typed during a save make it dirty again, so save until clean.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const ok = await get().save();
      if (!ok) return;
      if (!get().dirty) {
        get().closeProject();
        return;
      }
    }
  },

  undo() {
    const state = get();
    const target = state.past[state.past.length - 1];
    if (!target || !state.project) return;
    set({
      ...restore(state, target),
      past: state.past.slice(0, -1),
      future: [...state.future, { project: state.project, graphs: state.graphs, revision: state.revision }],
    });
  },

  redo() {
    const state = get();
    const target = state.future[state.future.length - 1];
    if (!target || !state.project) return;
    set({
      ...restore(state, target),
      future: state.future.slice(0, -1),
      past: [...state.past, { project: state.project, graphs: state.graphs, revision: state.revision }].slice(-HISTORY_LIMIT),
    });
  },

  resolveConfirm(confirmed) {
    const request = get().confirm;
    set({ confirm: null });
    if (confirmed) request?.onConfirm();
  },

  requestDeleteNodes(nodeIds, edgeIds = []) {
    const state = get();
    const graph = state.currentGraphId ? state.graphs[state.currentGraphId] : undefined;
    if (!graph) return;
    const run = () => {
      if (nodeIds.length > 0) get().deleteNodes(nodeIds, edgeIds);
      else if (edgeIds.length > 0) get().deleteEdges(edgeIds);
    };
    const remove = new Set(nodeIds);
    let nested = 0;
    for (const node of graph.nodes) {
      if (!remove.has(node.id) || !node.subgraphId) continue;
      for (const id of descendantGraphIds(state.graphs, node.subgraphId)) nested += state.graphs[id]?.nodes.length ?? 0;
    }
    const hasSubgraph = graph.nodes.some((node) => remove.has(node.id) && node.subgraphId && state.graphs[node.subgraphId]);
    if (!hasSubgraph) {
      run();
      return;
    }
    set({
      confirm: {
        title: nodeIds.length === 1 ? "Delete beat" : `Delete ${plural(nodeIds.length, "beat")}`,
        message: `Also deletes ${plural(nested, "nested beat")}.`,
        confirmLabel: "Delete",
        onConfirm: run,
      },
    });
  },

  requestDeleteSubgraph(nodeId) {
    const state = get();
    const graph = state.currentGraphId ? state.graphs[state.currentGraphId] : undefined;
    const node = graph?.nodes.find((item) => item.id === nodeId);
    if (!node?.subgraphId) return;
    let nested = 0;
    for (const id of descendantGraphIds(state.graphs, node.subgraphId)) nested += state.graphs[id]?.nodes.length ?? 0;
    set({
      confirm: {
        title: "Remove sub-graph",
        message: `Deletes ${plural(nested, "beat")}.`,
        confirmLabel: "Remove",
        onConfirm: () => get().deleteSubgraph(nodeId),
      },
    });
  },

  requestDeleteVariable(variableId) {
    const state = get();
    if (!state.project) return;
    const variable = state.project.variables.find((item) => item.id === variableId);
    const uses = countVariableRefs(state.project, state.graphs, variableId);
    if (!variable) return;
    if (uses === 0) {
      get().deleteVariable(variableId);
      return;
    }
    set({
      confirm: {
        title: `Delete ${variable.name || "variable"}`,
        message: `Used in ${plural(uses, "place")}.`,
        confirmLabel: "Delete",
        onConfirm: () => get().deleteVariable(variableId),
      },
    });
  },

  requestDeleteEntity(kind, entityId) {
    const state = get();
    if (!state.project) return;
    const entity = entitiesOf(state.project, kind).find((item) => item.id === entityId);
    if (!entity) return;
    const uses = countEntityRefs(state.project, state.graphs, entityId);
    if (uses === 0) {
      get().deleteEntity(kind, entityId);
      return;
    }
    set({
      confirm: {
        title: `Delete ${entity.name || kind}`,
        message: `Used in ${plural(uses, "place")}.`,
        confirmLabel: "Delete",
        onConfirm: () => get().deleteEntity(kind, entityId),
      },
    });
  },

  renameProject(name) {
    typing("project", { name });
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
    typing(`graph:${get().currentGraphId}`, patch);
    withGraph((graph) => ({ ...graph, ...patch }));
  },

  updateNode(nodeId, patch) {
    typing(`node:${nodeId}`, patch);
    withNode(nodeId, (node) => ({ ...node, ...patch, id: node.id, type: node.type }));
  },

  updateNodePosition(nodeId, position) {
    const graph = get().currentGraphId ? get().graphs[get().currentGraphId!] : undefined;
    const node = graph?.nodes.find((item) => item.id === nodeId);
    if (node && node.position.x === position.x && node.position.y === position.y) return;
    withNode(nodeId, (current) => ({ ...current, position }));
  },

  saveLocationLayout(patch) {
    withGraph((graph) => {
      let locationBoxes = graph.locationBoxes;
      if (patch.box) {
        const next = locationBoxes.filter((box) => box.id !== patch.box!.id);
        next.push(patch.box);
        locationBoxes = next;
      }
      const nodePositions = patch.nodePositions ?? {};
      return {
        ...graph,
        locationBoxes,
        nodes: graph.nodes.map((node) =>
          nodePositions[node.id] ? { ...node, locationPosition: nodePositions[node.id] } : node,
        ),
      };
    });
  },

  addNode(position) {
    const state = get();
    const graph = state.currentGraphId ? state.graphs[state.currentGraphId] : undefined;
    if (!graph) return;
    const maxX = graph.nodes.reduce((max, node) => Math.max(max, node.position.x), 0);
    const node = createNode({ position: position ?? { x: maxX + 280, y: 140 + (graph.nodes.length % 4) * 48 } });
    withGraph((current) => ({ ...current, nodes: [...current.nodes, node] }));
    set({ selection: { kind: "node", id: node.id } });
  },

  deleteNodes(nodeIds, edgeIds = []) {
    const remove = new Set(nodeIds);
    const removeEdges = new Set(edgeIds);
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
        edges: graph.edges.filter(
          (edge) => !removeEdges.has(edge.id) && !remove.has(edge.source) && !remove.has(edge.target),
        ),
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

  addConnectedNode(sourceId, position) {
    const state = get();
    const graph = state.currentGraphId ? state.graphs[state.currentGraphId] : undefined;
    if (!graph || !graph.nodes.some((node) => node.id === sourceId)) return;
    const node = createNode({ position });
    const edge = createEdge(sourceId, node.id);
    withGraph((current) => ({ ...current, nodes: [...current.nodes, node], edges: [...current.edges, edge] }));
    set({ selection: { kind: "node", id: node.id } });
  },

  addParallelTransition(edgeId) {
    const state = get();
    const graph = state.currentGraphId ? state.graphs[state.currentGraphId] : undefined;
    const edge = graph?.edges.find((item) => item.id === edgeId);
    if (!edge) return;
    const created = createEdge(edge.source, edge.target);
    withGraph((current) => {
      const index = current.edges.findIndex((item) => item.id === edgeId);
      if (index < 0) return current;
      const edges = current.edges.slice();
      edges.splice(index + 1, 0, created);
      return { ...current, edges };
    });
    set({ selection: { kind: "edge", id: created.id } });
  },

  insertBeatOnEdge(edgeId) {
    const state = get();
    if (!state.currentGraphId) return;
    const graph = state.graphs[state.currentGraphId];
    if (!graph) return;
    const edge = graph.edges.find((item) => item.id === edgeId);
    if (!edge) return;
    const node = createNode();
    const next = splitTransition(graph, edgeId, node, createEdge(node.id, edge.target));
    if (!next) return;
    set({
      graphs: { ...state.graphs, [state.currentGraphId]: next },
      selection: { kind: "node", id: node.id },
      dirty: true,
    });
  },

  updateEdge(edgeId, patch) {
    typing(`edge:${edgeId}`, patch);
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
    if (!state.currentGraphId) return;
    const graph = state.graphs[state.currentGraphId];
    const node = graph?.nodes.find((item) => item.id === nodeId);
    if (!node?.subgraphId || !state.graphs[node.subgraphId]) return;
    set({ currentGraphId: node.subgraphId, selection: null, screen: "graph" });
  },

  createSubgraph(nodeId) {
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
      name: node.title.trim(),
      parentGraphId: graph.id,
      parentNodeId: node.id,
    });
    child.nodes = [createNode({ position: { x: 160, y: 180 } })];
    const parent = { ...graph, nodes: graph.nodes.map((item) => (item.id === nodeId ? { ...item, subgraphId: child.id } : item)) };
    set((current) => ({
      graphs: { ...current.graphs, [graph.id]: parent, [child.id]: child },
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
    const speaker = get().project?.characters[0]?.id ?? null;
    withNode(nodeId, (node) => ({ ...node, lines: [...node.lines, createLine({ speakerId: speaker })] }));
  },

  updateLine(nodeId, lineId, patch) {
    typing(`line:${nodeId}:${lineId}`, patch);
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

  addNodeEffect(nodeId) {
    const effect = blankEffect(get().project?.variables ?? []);
    withNode(nodeId, (node) => ({ ...node, effects: [...node.effects, effect] }));
  },

  updateNodeEffect(nodeId, effectId, patch) {
    withNode(nodeId, (node) => ({
      ...node,
      effects: node.effects.map((effect) => (effect.id === effectId ? { ...effect, ...patch, id: effect.id } : effect)),
    }));
  },

  deleteNodeEffect(nodeId, effectId) {
    withNode(nodeId, (node) => ({ ...node, effects: node.effects.filter((effect) => effect.id !== effectId) }));
  },

  addVariable(kind) {
    set((state) => {
      if (!state.project) return {};
      const base =
        kind === "boolean" ? "flag" : kind === "value" ? "amount" : kind === "inventory" ? "inventory" : kind === "character" || kind === "item" || kind === "location" ? kind : "variable";
      const taken = state.project.variables.map((variable) => variable.name);
      let count = state.project.variables.filter((variable) => variable.kind === kind).length + 1;
      let name = count === 1 && kind === "inventory" ? "inventory" : `${base}${count}`;
      while (isDuplicateName(name, taken)) {
        count += 1;
        name = `${base}${count}`;
      }
      const variable = createVariable(kind, { name });
      return { project: { ...state.project, variables: [...state.project.variables, variable] }, dirty: true };
    });
    return get().project?.variables.at(-1)?.id ?? null;
  },

  updateVariable(variableId, patch) {
    typing(`variable:${variableId}`, patch);
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
      return deleteVariableEverywhere(state.project, state.graphs, variableId);
    });
  },

  addEntity(kind, name = "") {
    const project = get().project;
    if (!project) return null;
    const entities = entitiesOf(project, kind);
    const wanted = name.trim() ? uniqueName(name, entities.map((item) => item.name)) : newEntityName(kind, entities);
    const entity = createEntity({ name: wanted });
    set((state) => {
      if (!state.project) return {};
      return { project: withEntities(state.project, kind, [...entitiesOf(state.project, kind), entity]), dirty: true };
    });
    return entity.id;
  },

  updateEntity(kind, entityId, patch) {
    typing(`entity:${entityId}`, patch);
    set((state) => {
      if (!state.project) return {};
      const entities = entitiesOf(state.project, kind).map((entity) =>
        entity.id === entityId ? { ...entity, ...patch, id: entity.id } : entity,
      );
      return { project: withEntities(state.project, kind, entities), dirty: true };
    });
  },

  deleteEntity(kind, entityId) {
    // Its image files are removed by the next save.
    set((state) => {
      if (!state.project) return {};
      return deleteEntityEverywhere(state.project, state.graphs, kind, entityId);
    });
  },

  async addEntityImages(kind, entityId) {
    const state = get();
    if (!state.project || !state.projectPath) {
      set({ banner: { tone: "error", text: "Save the project before adding images." } });
      return;
    }
    const entity = entitiesOf(state.project, kind).find((item) => item.id === entityId);
    if (!entity) return;
    try {
      const added = await copyImagesIntoProject(state.projectPath, entityId, entity.images);
      if (added.length === 0) return;
      for (const path of added) diskImages.add(path);
      get().updateEntity(kind, entityId, { images: [...entity.images, ...added] });
    } catch (error) {
      set({ banner: { tone: "error", text: errorMessage(error) } });
    }
  },

  async removeEntityImage(kind, entityId, path) {
    const state = get();
    const entity = state.project ? entitiesOf(state.project, kind).find((item) => item.id === entityId) : undefined;
    if (!entity) return;
    // The file stays until the next save, so discarding or undoing keeps it.
    get().updateEntity(kind, entityId, { images: entity.images.filter((item) => item !== path) });
  },

  restartPlay() {
    const state = get();
    if (!state.project) return;
    set({ play: createPlayState(state.project, state.graphs) });
  },

  beginPlay(nodeId) {
    const state = get();
    if (!state.play) return;
    if (!state.project) return;
    set({ play: chooseStart(state.play, state.graphs, nodeId, state.project.variables) });
  },

  cancelStartChoice() {
    const play = get().play;
    if (!play?.choosingGraphId || play.frames.length === 0) return;
    set({ play: { ...play, choosingGraphId: null } });
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
};
});
