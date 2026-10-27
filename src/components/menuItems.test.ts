import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryFs, createNewProject, saveProject } from "../domain/project";
import { createEntity, createVariable } from "../domain/factories";
import { setProjectFs, useProjectStore } from "../store/projectStore";
import type { MenuItem } from "./ContextMenu";
import { beatItems, edgeItems } from "./menuItems";

// Focus and popover timers have no DOM here.
vi.stubGlobal("window", { setTimeout: () => 0 });

const store = () => useProjectStore.getState();
const root = () => store().graphs[store().project!.rootGraphId];
const labels = (items: MenuItem[]) => items.flatMap((item) => (item === "separator" ? [] : [item.label]));
const pick = (items: MenuItem[], label: string) => {
  const item = items.find((entry) => entry !== "separator" && entry.label === label);
  if (!item || item === "separator") throw new Error(`no ${label}`);
  item.onSelect();
};
const at = { x: 10, y: 10 };

beforeEach(async () => {
  store().closeProject();
  const files = createMemoryFs();
  const created = createNewProject("Menus", "2026-01-01T00:00:00.000Z");
  created.project.characters = [createEntity({ id: "hero", name: "Hero" })];
  created.project.variables = [createVariable("boolean", { id: "open", name: "open" })];
  created.graphs[created.project.rootGraphId].nodes[0].characterIds = ["hero"];
  await saveProject(files, "/m", created.project, created.graphs);
  setProjectFs(files);
  await store().openAt("/m");
  store().addConnectedNode(root().nodes[0].id, { x: 300, y: 0 });
});

describe("connection menu", () => {
  it("adds a condition with one rule as one step, then offers edit and remove", () => {
    const edgeId = root().edges[0].id;
    expect(labels(edgeItems(edgeId, at))).toContain("Add condition…");
    const depth = store().past.length;
    pick(edgeItems(edgeId, at), "Add condition…");
    expect(root().edges[0].condition).toEqual({ type: "compare", variableId: "", op: "eq", value: null });
    expect(store().past.length).toBe(depth + 1);
    expect(labels(edgeItems(edgeId, at))).toEqual(expect.arrayContaining(["Edit condition…", "Remove condition"]));
    pick(edgeItems(edgeId, at), "Remove condition");
    expect(root().edges[0].condition).toBeNull();
    store().undo();
    expect(root().edges[0].condition).not.toBeNull();
  });
});

describe("event menu", () => {
  it("lists add entries and a remove entry for each thing the event lists", () => {
    const node = root().nodes[0];
    const items = beatItems(node, at);
    expect(labels(items)).toEqual(expect.arrayContaining(["Add character…", "Add item…", "Set location…", "Remove Hero", "Add line", "Add effect…"]));
    pick(items, "Remove Hero");
    expect(root().nodes[0].characterIds).toEqual([]);
  });

  it("adds an effect and switches to Write mode for a new line", () => {
    const node = root().nodes[0];
    pick(beatItems(node, at), "Add effect…");
    expect(root().nodes[0].effects).toHaveLength(1);
    expect(labels(beatItems(node, at))).toContain("Edit effects…");
    pick(beatItems(node, at), "Add line");
    expect(store().editMode).toBe("write");
    expect(store().selection).toEqual({ kind: "node", id: node.id });
    expect(root().nodes[0].lines).toHaveLength(1);
  });
});
