import { createGraph, createNode } from "./factories";
import { createId } from "./ids";
import { graphFileName, joinPath } from "./paths";
import { indexInvolved, involvement } from "./involved";
import { migrationContext, parseGraph, parseJson, parseProject, stringifyDoc } from "./schema";
import {
  BUNDLE_KIND,
  GRAPHS_DIR,
  PROJECT_FILE,
  SCHEMA_VERSION,
  type GraphDocument,
  type ProjectBundle,
  type ProjectDocument,
} from "./types";

export interface ProjectFs {
  readText(path: string): Promise<string>;
  writeText(path: string, contents: string): Promise<void>;
  list(path: string): Promise<string[]>;
  mkdir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  remove(path: string): Promise<void>;
}

export interface LoadedProject {
  project: ProjectDocument;
  graphs: Record<string, GraphDocument>;
}

export function createMemoryFs(initial: Record<string, string> = {}): ProjectFs & {
  dump(): Record<string, string>;
} {
  const files = new Map<string, string>();
  const dirs = new Set<string>(["/"]);
  for (const [path, contents] of Object.entries(initial)) {
    files.set(normalize(path), contents);
    ensureAncestors(dirs, normalize(path), false);
  }
  return {
    async readText(path) {
      const key = normalize(path);
      const contents = files.get(key);
      if (contents === undefined) throw new Error(`No such file: ${key}`);
      return contents;
    },
    async writeText(path, contents) {
      const key = normalize(path);
      const parent = parentPath(key);
      if (parent && !dirs.has(parent)) throw new Error(`No such directory: ${parent}`);
      files.set(key, contents);
    },
    async list(path) {
      const dir = normalize(path);
      if (!dirs.has(dir)) throw new Error(`No such directory: ${dir}`);
      const prefix = dir === "/" ? "/" : `${dir}/`;
      const names = new Set<string>();
      for (const file of files.keys()) {
        if (file.startsWith(prefix)) {
          const rest = file.slice(prefix.length);
          if (!rest.includes("/")) names.add(rest);
        }
      }
      for (const stored of dirs) {
        if (stored.startsWith(prefix)) {
          const rest = stored.slice(prefix.length);
          if (rest && !rest.includes("/")) names.add(rest);
        }
      }
      return [...names].sort();
    },
    async mkdir(path) {
      ensureAncestors(dirs, normalize(path), true);
    },
    async exists(path) {
      const key = normalize(path);
      return files.has(key) || dirs.has(key);
    },
    async remove(path) {
      files.delete(normalize(path));
    },
    dump() {
      return Object.fromEntries(files);
    },
  };
}

function normalize(path: string): string {
  const slashed = path.replace(/\\/g, "/");
  const absolute = slashed.startsWith("/");
  const segments: string[] = [];
  for (const part of slashed.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") segments.pop();
    else segments.push(part);
  }
  return (absolute ? "/" : "") + segments.join("/");
}

function parentPath(path: string): string | null {
  const index = path.lastIndexOf("/");
  if (index < 0) return null;
  if (index === 0) return "/";
  return path.slice(0, index);
}

function ensureAncestors(dirs: Set<string>, path: string, includeSelf: boolean) {
  const parts = path.split("/").filter(Boolean);
  let current = path.startsWith("/") ? "" : "";
  const absolute = path.startsWith("/");
  const last = includeSelf ? parts.length : parts.length - 1;
  for (let index = 0; index < last; index += 1) {
    current = absolute ? `${current}/${parts[index]}` : current ? `${current}/${parts[index]}` : parts[index];
    dirs.add(current);
  }
  if (absolute) dirs.add("/");
}

export function createNewProject(
  name: string,
  now = new Date().toISOString(),
): LoadedProject {
  const rootId = createId();
  const beat = createNode({ position: { x: 160, y: 180 } });
  const graph = createGraph({
    id: rootId,
    name,
    nodes: [beat],
    edges: [],
  });
  const project: ProjectDocument = {
    schemaVersion: SCHEMA_VERSION,
    id: createId(),
    name,
    createdAt: now,
    updatedAt: now,
    rootGraphId: rootId,
    variables: [],
    characters: [],
    items: [],
    locations: [],
  };
  return { project, graphs: { [rootId]: graph } };
}

export async function saveProject(
  fs: ProjectFs,
  root: string,
  project: ProjectDocument,
  graphs: Record<string, GraphDocument>,
  now = new Date().toISOString(),
): Promise<ProjectDocument> {
  const saved: ProjectDocument = { ...project, updatedAt: now };
  await fs.mkdir(root);
  await fs.mkdir(joinPath(root, GRAPHS_DIR));
  await fs.writeText(joinPath(root, PROJECT_FILE), stringifyDoc(saved));
  const keep = new Set<string>();
  for (const graph of Object.values(graphs)) {
    const filename = graphFileName(graph.id);
    keep.add(filename);
    await fs.writeText(joinPath(root, GRAPHS_DIR, filename), stringifyDoc(graph));
  }
  const existing = await fs.list(joinPath(root, GRAPHS_DIR));
  for (const name of existing) {
    if (name.endsWith(".json") && !keep.has(name)) {
      await fs.remove(joinPath(root, GRAPHS_DIR, name));
    }
  }
  return saved;
}

export async function loadProject(fs: ProjectFs, root: string): Promise<LoadedProject> {
  const rawProject = parseJson(await fs.readText(joinPath(root, PROJECT_FILE)), PROJECT_FILE);
  const context = migrationContext(rawProject);
  const project = parseProject(rawProject);
  const graphs: Record<string, GraphDocument> = {};
  const names = await fs.list(joinPath(root, GRAPHS_DIR));
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const graph = parseGraph(parseJson(await fs.readText(joinPath(root, GRAPHS_DIR, name)), name), context);
    if (graphs[graph.id]) {
      throw new Error(`Two graph files use the id ${graph.id}`);
    }
    graphs[graph.id] = graph;
  }
  if (!graphs[project.rootGraphId]) {
    throw new Error("The project root graph file is missing.");
  }
  return { project, graphs };
}

export function bundleProject(
  project: ProjectDocument,
  graphs: Record<string, GraphDocument>,
  exportedAt: string,
): ProjectBundle {
  const involved = indexInvolved(graphs);
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: BUNDLE_KIND,
    exportedAt,
    project,
    graphs: Object.values(graphs)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((graph) => ({
        ...graph,
        nodes: graph.nodes.map((node) => ({
          ...node,
          involved: involvement(involved, graph.id, node.id).all,
        })) as GraphDocument["nodes"],
      })),
  };
}

export function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "story";
}
