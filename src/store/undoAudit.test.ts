import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryFs, createNewProject, saveProject } from "../domain/project";
import { createEntity } from "../domain/factories";
import { setProjectFs, useProjectStore } from "./projectStore";

vi.mock("../desktop/tauri", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../desktop/tauri")>()),
  pickFiles: vi.fn(async () => ["/pics/a.png"]),
}));

const ROOT = "/audit";
const store = () => useProjectStore.getState();
const root = () => store().graphs[store().project!.rootGraphId];
const content = () => JSON.stringify({ project: store().project, graphs: store().graphs });

async function open() {
  const files = createMemoryFs();
  const created = createNewProject("Audit", "2026-01-01T00:00:00.000Z");
  created.project.characters = [createEntity({ id: "hero", name: "Hero" })];
  created.project.items = [createEntity({ id: "key", name: "Key" })];
  created.project.locations = [createEntity({ id: "gate", name: "Gate" })];
  await saveProject(files, ROOT, created.project, created.graphs);
  setProjectFs(files);
  await store().openAt(ROOT);
  // A second event and a transition to work with.
  store().addConnectedNode(root().nodes[0].id, { x: 300, y: 0 });
  store().addVariable("boolean");
  return files;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  store().closeProject();
});
afterEach(() => {
  vi.useRealTimers();
  setProjectFs(null);
});

type Step = [string, () => unknown];

const steps = (): Step[] => {
  const a = () => root().nodes[0].id;
  const b = () => root().nodes[1].id;
  const edge = () => root().edges[0].id;
  const variable = () => store().project!.variables[0].id;
  return [
    ["rename project", () => store().renameProject("Other")],
    ["graph notes", () => store().updateGraphMeta({ sceneNotes: "Notes" })],
    ["event title", () => store().updateNode(a(), { title: "Gate" })],
    ["event chips", () => store().updateNode(a(), { characterIds: ["hero"], locationId: "gate" })],
    ["drag position", () => store().updateNodePosition(a(), { x: 50, y: 60 })],
    ["move to location", () => store().moveToLocation(a(), "gate", { x: 10, y: 10 })],
    ["add event", () => store().addNode({ x: 0, y: 300 })],
    ["drag out", () => store().addConnectedNode(a(), { x: 0, y: 400 })],
    ["duplicate", () => store().duplicateNode(a())],
    ["insert on edge", () => store().insertBeatOnEdge(edge())],
    ["delete events", () => store().deleteNodes([b()])],
    ["connect", () => store().connectNodes(b(), a())],
    ["edit transition", () => store().updateEdge(edge(), { label: "Go" })],
    ["delete transition", () => store().deleteEdges([edge()])],
    ["add children", () => store().createSubgraph(a())],
    ["add line", () => store().addLine(a())],
    ["add effect", () => store().addNodeEffect(a())],
    ["add variable", () => store().addVariable("value")],
    ["rename variable", () => store().updateVariable(variable(), { name: "flag" })],
    ["delete variable", () => store().deleteVariable(variable())],
    ["add entity", () => store().addEntity("item", "Lamp")],
    ["entity notes", () => store().updateEntity("character", "hero", { notes: "Brave" })],
    ["quick-create", () => store().createEntityAnd("character", "Guard", (id) => store().updateNode(a(), { characterIds: [id] }))],
    ["delete entity", () => store().deleteEntity("item", "key")],
    ["remove image", () => store().removeEntityImage("character", "hero", "assets/hero/a.png")],
  ];
};

describe("every edit is one undo step", () => {
  it.each(steps().map(([name], index) => [name, index]))("%s", async (_name, index) => {
    await open();
    if (index === 24) store().updateEntity("character", "hero", { images: ["assets/hero/a.png"] });
    vi.advanceTimersByTime(5000);
    const before = content();
    const depth = store().past.length;
    await steps()[index as number][1]();
    expect(content()).not.toBe(before);
    expect(store().past.length).toBe(depth + 1);
    const after = content();
    store().undo();
    expect(content()).toBe(before);
    store().redo();
    expect(content()).toBe(after);
  });
});

describe("undo returns to where the change was made", () => {
  it("goes back into the child graph and reselects the event", async () => {
    await open();
    const parent = root().nodes[0].id;
    store().select({ kind: "node", id: parent });
    store().createSubgraph(parent);
    const child = store().currentGraphId!;
    const inner = store().graphs[child].nodes[0].id;
    store().select({ kind: "node", id: inner });
    vi.advanceTimersByTime(5000);
    store().updateNode(inner, { title: "Inside" });
    store().openGraph(store().project!.rootGraphId);
    store().select(null);
    store().undo();
    expect(store().currentGraphId).toBe(child);
    expect(store().selection).toEqual({ kind: "node", id: inner });
    expect(store().graphs[child].nodes[0].title).toBe("");
    store().undo();
    expect(store().currentGraphId).toBe(store().project!.rootGraphId);
    expect(store().selection).toEqual({ kind: "node", id: parent });
    store().redo();
    expect(store().currentGraphId).toBe(child);
  });

  it("does not offer numbering on open as an undo step", async () => {
    const files = createMemoryFs();
    const created = createNewProject("Old", "2026-01-01T00:00:00.000Z");
    created.graphs[created.project.rootGraphId].nodes[0].number = 0;
    await saveProject(files, ROOT, created.project, created.graphs);
    setProjectFs(files);
    await store().openAt(ROOT);
    expect(root().nodes[0].number).toBe(1);
    expect(store().past).toHaveLength(0);
  });
});
