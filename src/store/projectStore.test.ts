import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryFs, createNewProject, saveProject, type ProjectFs } from "../domain/project";
import { createEntity } from "../domain/factories";
import { COALESCE_MS, HISTORY_LIMIT, setProjectFs, useProjectStore } from "./projectStore";
import * as desktop from "../desktop/tauri";

vi.mock("../desktop/tauri", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../desktop/tauri")>()),
  pickDirectory: vi.fn(async () => null),
  copyFile: vi.fn(async () => undefined),
}));

const ROOT = "/proj";

async function openFresh(extra?: (fs: ReturnType<typeof createMemoryFs>) => Promise<void>) {
  const files = createMemoryFs();
  const created = createNewProject("Test", "2026-01-01T00:00:00.000Z");
  created.project.characters = [createEntity({ id: "hero", name: "Hero", images: ["assets/hero/a.png"] })];
  await saveProject(files, ROOT, created.project, created.graphs);
  await files.mkdir(`${ROOT}/assets/hero`);
  await files.writeText(`${ROOT}/assets/hero/a.png`, "png");
  await extra?.(files);
  setProjectFs(files);
  const ok = await useProjectStore.getState().openAt(ROOT);
  expect(ok).toBe(true);
  return files;
}

function store() {
  return useProjectStore.getState();
}

function rootGraph() {
  const state = store();
  return state.graphs[state.project!.rootGraphId];
}

beforeEach(() => {
  vi.useRealTimers();
  store().closeProject();
});

afterEach(() => {
  setProjectFs(null);
});

describe("undo and redo", () => {
  it("undoes and redoes graph edits and restores the dirty state", async () => {
    await openFresh();
    expect(store().dirty).toBe(false);
    const before = rootGraph().nodes.length;
    store().addNode({ x: 1, y: 1 });
    expect(rootGraph().nodes.length).toBe(before + 1);
    expect(store().dirty).toBe(true);
    store().undo();
    expect(rootGraph().nodes.length).toBe(before);
    expect(store().dirty).toBe(false);
    store().redo();
    expect(rootGraph().nodes.length).toBe(before + 1);
    expect(store().dirty).toBe(true);
  });

  it("clears redo after a new edit", async () => {
    await openFresh();
    store().addNode();
    store().undo();
    expect(store().future).toHaveLength(1);
    store().addVariable("boolean");
    expect(store().future).toHaveLength(0);
  });

  it("merges quick typing in one field into a single step", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    await openFresh();
    const id = rootGraph().nodes[0].id;
    for (const title of ["H", "He", "Hel", "Hell", "Hello"]) {
      store().updateNode(id, { title });
      vi.advanceTimersByTime(100);
    }
    expect(store().past).toHaveLength(1);
    vi.advanceTimersByTime(COALESCE_MS + 1);
    store().updateNode(id, { title: "Hello!" });
    expect(store().past).toHaveLength(2);
    store().undo();
    expect(rootGraph().nodes[0].title).toBe("Hello");
    store().undo();
    expect(rootGraph().nodes[0].title).toBe("");
    expect(store().dirty).toBe(false);
  });

  it("does not merge typing in different fields", async () => {
    await openFresh();
    const id = rootGraph().nodes[0].id;
    store().updateNode(id, { title: "A" });
    store().updateNode(id, { summary: "B" });
    expect(store().past).toHaveLength(2);
  });

  it("keeps a saved state clean when undone back to", async () => {
    await openFresh();
    store().addNode();
    await store().save();
    expect(store().dirty).toBe(false);
    store().addNode();
    expect(store().dirty).toBe(true);
    store().undo();
    expect(store().dirty).toBe(false);
    store().undo();
    expect(store().dirty).toBe(true);
  });

  it("caps history and clears it on open and close", async () => {
    await openFresh();
    for (let index = 0; index < HISTORY_LIMIT + 20; index += 1) store().addNode();
    expect(store().past).toHaveLength(HISTORY_LIMIT);
    store().closeProject();
    expect(store().past).toHaveLength(0);
    await openFresh();
    expect(store().past).toHaveLength(0);
  });

  it("leaves a sub-graph that undo removes", async () => {
    await openFresh();
    const id = rootGraph().nodes[0].id;
    store().createSubgraph(id);
    expect(store().currentGraphId).not.toBe(store().project!.rootGraphId);
    expect(store().past).toHaveLength(1);
    store().undo();
    expect(store().currentGraphId).toBe(store().project!.rootGraphId);
    expect(Object.keys(store().graphs)).toHaveLength(1);
  });
});

describe("confirmed deletes", () => {
  it("asks before deleting a beat with a sub-graph", async () => {
    await openFresh();
    const id = rootGraph().nodes[0].id;
    store().createSubgraph(id);
    store().openGraph(store().project!.rootGraphId);
    store().requestDeleteNodes([id]);
    expect(store().confirm?.message).toBe("Also deletes 1 nested beat.");
    store().resolveConfirm(false);
    expect(rootGraph().nodes).toHaveLength(1);
    store().requestDeleteNodes([id]);
    store().resolveConfirm(true);
    expect(rootGraph().nodes).toHaveLength(0);
    expect(Object.keys(store().graphs)).toHaveLength(1);
  });

  it("deletes a plain beat at once", async () => {
    await openFresh();
    store().requestDeleteNodes([rootGraph().nodes[0].id]);
    expect(store().confirm).toBeNull();
    expect(rootGraph().nodes).toHaveLength(0);
  });

  it("asks before deleting a character in use and clears its references", async () => {
    await openFresh();
    const id = rootGraph().nodes[0].id;
    store().updateNode(id, { characterIds: ["hero"] });
    store().addLine(id);
    store().requestDeleteEntity("character", "hero");
    expect(store().confirm?.message).toBe("Used in 2 places.");
    store().resolveConfirm(true);
    const node = rootGraph().nodes[0];
    expect(node.characterIds).toEqual([]);
    expect(node.lines[0].speakerId).toBeNull();
    expect(store().project!.characters).toHaveLength(0);
  });
});

describe("images", () => {
  it("keeps a removed image on disk until save", async () => {
    const files = await openFresh();
    await store().removeEntityImage("character", "hero", "assets/hero/a.png");
    expect(await files.exists(`${ROOT}/assets/hero/a.png`)).toBe(true);
    store().undo();
    expect(store().project!.characters[0].images).toEqual(["assets/hero/a.png"]);
    store().redo();
    // Undo history still points at it, so even a save keeps the file.
    await store().save();
    expect(await files.exists(`${ROOT}/assets/hero/a.png`)).toBe(true);
    store().closeProject();
    const fresh = await openFresh();
    await store().removeEntityImage("character", "hero", "assets/hero/a.png");
    useProjectStore.setState({ past: [], future: [] });
    await store().save();
    expect(await fresh.exists(`${ROOT}/assets/hero/a.png`)).toBe(false);
  });

  it("removes a deleted entity's images on save, not before", async () => {
    const files = await openFresh();
    store().deleteEntity("character", "hero");
    expect(Object.keys(files.dump())).toContain(`${ROOT}/assets/hero/a.png`);
    useProjectStore.setState({ past: [], future: [] });
    await store().save();
    expect(Object.keys(files.dump())).not.toContain(`${ROOT}/assets/hero/a.png`);
  });

  it("leaves disk untouched on discard", async () => {
    const files = await openFresh();
    await store().removeEntityImage("character", "hero", "assets/hero/a.png");
    store().discardAndClose();
    await vi.waitFor(() => expect(store().project).toBeNull());
    expect(await files.exists(`${ROOT}/assets/hero/a.png`)).toBe(true);
  });
});

describe("sanitize on open", () => {
  it("drops dangling references and marks the project unsaved", async () => {
    await openFresh(async (files) => {
      const path = Object.keys(files.dump()).find((item) => item.includes("/graphs/"))!;
      const raw = JSON.parse(await files.readText(path));
      raw.nodes[0].characterIds = ["ghost"];
      await files.writeText(path, JSON.stringify(raw));
    });
    expect(rootGraph().nodes[0].characterIds).toEqual([]);
    expect(store().dirty).toBe(true);
    expect(store().past).toHaveLength(0);
  });
});

describe("save race", () => {
  function gatedFs(inner: ProjectFs) {
    let release: () => void = () => undefined;
    let gate: Promise<void> | null = null;
    let writes = 0;
    const fs: ProjectFs = {
      ...inner,
      async writeText(path, contents) {
        writes += 1;
        if (gate) await gate;
        return inner.writeText(path, contents);
      },
    };
    return {
      fs,
      hold() {
        gate = new Promise<void>((resolve) => {
          release = () => {
            gate = null;
            resolve();
          };
        });
      },
      release: () => release(),
      writes: () => writes,
    };
  }

  it("keeps edits made during a save and leaves them unsaved", async () => {
    const files = await openFresh();
    const gated = gatedFs(files);
    setProjectFs(gated.fs);
    const id = rootGraph().nodes[0].id;
    store().updateNode(id, { title: "Saved" });
    gated.hold();
    const saving = store().save();
    store().updateNode(id, { summary: "Typed while saving" });
    gated.release();
    expect(await saving).toBe(true);
    expect(rootGraph().nodes[0].title).toBe("Saved");
    expect(rootGraph().nodes[0].summary).toBe("Typed while saving");
    expect(store().dirty).toBe(true);
    const onDisk = Object.entries(files.dump()).find(([path]) => path.includes("/graphs/"))![1];
    expect(onDisk).toContain("Saved");
    expect(onDisk).not.toContain("Typed while saving");
    await store().save();
    expect(store().dirty).toBe(false);
  });

  it("marks clean when nothing changed during the save", async () => {
    await openFresh();
    store().addNode();
    expect(await store().save()).toBe(true);
    expect(store().dirty).toBe(false);
  });

  it("does not start a second save while one is running", async () => {
    const files = await openFresh();
    const gated = gatedFs(files);
    setProjectFs(gated.fs);
    store().addNode();
    gated.hold();
    const first = store().save();
    const second = store().save();
    expect(second).toBe(first);
    gated.release();
    await Promise.all([first, second]);
    const writesAfterOne = gated.writes();
    await store().save();
    expect(gated.writes()).toBeGreaterThan(writesAfterOne);
  });

  it("save and close keeps saving until edits made meanwhile are written", async () => {
    const files = await openFresh();
    const gated = gatedFs(files);
    setProjectFs(gated.fs);
    const id = rootGraph().nodes[0].id;
    store().updateNode(id, { title: "One" });
    gated.hold();
    const closing = store().saveAndClose();
    store().updateNode(id, { summary: "Two" });
    gated.release();
    await closing;
    expect(store().project).toBeNull();
    const onDisk = Object.entries(files.dump()).find(([path]) => path.includes("/graphs/"))![1];
    expect(onDisk).toContain("Two");
  });
});

describe("names", () => {
  it("gives new entities distinct names", async () => {
    await openFresh();
    store().addEntity("character");
    store().addEntity("character");
    store().addEntity("character", "Hero");
    const names = store().project!.characters.map((item) => item.name);
    expect(names).toEqual(["Hero", "Character 2", "Character 3", "Hero 2"]);
  });

  it("gives new variables distinct names", async () => {
    await openFresh();
    store().addVariable("boolean");
    store().updateVariable(store().project!.variables[0].id, { name: "flag2" });
    store().addVariable("boolean");
    const names = store().project!.variables.map((item) => item.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("transitions and beats", () => {
  it("keeps one transition per pair", async () => {
    await openFresh();
    store().addNode({ x: 0, y: 0 });
    store().addNode({ x: 300, y: 0 });
    const [a, b] = rootGraph().nodes.slice(-2).map((node) => node.id);
    const before = rootGraph().edges.length;
    store().connectNodes(a, b);
    const first = store().selection;
    store().connectNodes(a, b);
    expect(rootGraph().edges.length).toBe(before + 1);
    expect(store().selection).toEqual(first);
    store().addReverseTransition(first!.id);
    store().addReverseTransition(first!.id);
    expect(rootGraph().edges.filter((edge) => edge.source === b && edge.target === a)).toHaveLength(1);
  });

  it("does not retarget a transition onto an existing pair", async () => {
    await openFresh();
    store().addNode({ x: 0, y: 0 });
    store().addNode({ x: 300, y: 0 });
    store().addNode({ x: 600, y: 0 });
    const [a, b, c] = rootGraph().nodes.slice(-3).map((node) => node.id);
    store().connectNodes(a, b);
    store().connectNodes(a, c);
    const toC = store().selection!.id;
    store().updateEdge(toC, { target: b });
    expect(rootGraph().edges.find((edge) => edge.id === toC)?.target).toBe(c);
  });

  it("duplicates a beat with fresh ids and no sub-graph", async () => {
    await openFresh();
    store().addNode({ x: 10, y: 10 });
    const source = rootGraph().nodes.at(-1)!;
    store().addLine(source.id);
    store().createSubgraph(source.id);
    store().openGraph(store().project!.rootGraphId);
    store().duplicateNode(source.id);
    const copy = rootGraph().nodes.at(-1)!;
    expect(copy.id).not.toBe(source.id);
    expect(copy.subgraphId).toBeNull();
    expect(copy.lines).toHaveLength(1);
    expect(copy.lines[0].id).not.toBe(rootGraph().nodes.find((node) => node.id === source.id)!.lines[0].id);
    expect(copy.position).toEqual({ x: 50, y: 50 });
    expect(store().selection).toEqual({ kind: "node", id: copy.id });
  });
});

describe("sub-graph names", () => {
  it("leaves a new sub-graph unnamed so it follows the beat", async () => {
    await openFresh();
    store().addNode({ x: 0, y: 0 });
    const node = rootGraph().nodes.at(-1)!;
    store().updateNode(node.id, { title: "Gate" });
    store().createSubgraph(node.id);
    const child = store().graphs[store().currentGraphId!];
    expect(child.name).toBe("");
  });
});

describe("lines and effects", () => {
  it("adds a line after another with the same speaker", async () => {
    await openFresh();
    store().addNode({ x: 0, y: 0 });
    const id = rootGraph().nodes.at(-1)!.id;
    const first = store().addLine(id)!;
    store().updateLine(id, first, { speakerId: null });
    const last = store().addLine(id)!;
    store().updateLine(id, last, { speakerId: "hero" });
    const middle = store().addLine(id, first)!;
    const lines = rootGraph().nodes.find((node) => node.id === id)!.lines;
    expect(lines.map((line) => line.id)).toEqual([first, middle, last]);
    expect(lines[1].speakerId).toBeNull();
    const after = store().addLine(id)!;
    expect(rootGraph().nodes.find((node) => node.id === id)!.lines.find((line) => line.id === after)?.speakerId).toBe("hero");
  });

  it("reorders effects", async () => {
    await openFresh();
    store().addVariable("boolean");
    store().addNode({ x: 0, y: 0 });
    const id = rootGraph().nodes.at(-1)!.id;
    store().addNodeEffect(id);
    store().addNodeEffect(id);
    const [a, b] = rootGraph().nodes.at(-1)!.effects.map((effect) => effect.id);
    store().moveNodeEffect(id, b, -1);
    expect(rootGraph().nodes.at(-1)!.effects.map((effect) => effect.id)).toEqual([b, a]);
  });
});

describe("save as", () => {
  it("writes the project, unsaved edits included, into a new folder and continues there", async () => {
    const files = await openFresh();
    store().renameProject("Copy Me");
    vi.mocked(desktop.pickDirectory).mockResolvedValueOnce("/elsewhere");
    expect(await store().saveAs()).toBe(true);
    expect(store().projectPath).toBe("/elsewhere/copy-me");
    expect(store().dirty).toBe(false);
    expect(await files.readText("/elsewhere/copy-me/project.json")).toContain("Copy Me");
    expect(JSON.parse(await files.readText(`${ROOT}/project.json`)).name).toBe("Test");
    expect(desktop.copyFile).toHaveBeenCalledWith(`${ROOT}/assets/hero/a.png`, "/elsewhere/copy-me/assets/hero/a.png");
  });

  it("refuses a folder that already holds a project", async () => {
    await openFresh();
    vi.mocked(desktop.pickDirectory).mockResolvedValueOnce("/");
    store().renameProject("proj");
    expect(await store().saveAs()).toBe(false);
    expect(store().projectPath).toBe(ROOT);
    expect(store().banner?.tone).toBe("error");
  });
});

describe("quick create", () => {
  it("creates an entity and assigns it as one undo step", async () => {
    await openFresh();
    const node = rootGraph().nodes[0];
    store().select({ kind: "node", id: node.id });
    const id = store().createEntityAnd("location", "Harbor", (created) => store().updateNode(node.id, { locationId: created }));
    expect(store().project!.locations.some((item) => item.id === id && item.name === "Harbor")).toBe(true);
    expect(rootGraph().nodes[0].locationId).toBe(id);
    store().undo();
    expect(store().project!.locations.some((item) => item.id === id)).toBe(false);
    expect(rootGraph().nodes[0].locationId).toBeNull();
    store().redo();
    expect(rootGraph().nodes[0].locationId).toBe(id);
  });
});
