import { describe, expect, it } from "vitest";
import { createEdge, createGraph, createNode } from "./factories";
import { bundleProject, createMemoryFs, createNewProject, loadProject, saveProject } from "./project";
import { SCHEMA_VERSION } from "./types";

describe("project folder round trip", () => {
  it("saves one project file and one file per graph, then loads them intact", async () => {
    const created = createNewProject("Harbor", "2026-01-01T00:00:00.000Z");
    const root = created.graphs[created.project.rootGraphId];
    const childId = "graph_child";
    const child = createGraph({
      id: childId,
      name: "Inner",
      parentGraphId: root.id,
      parentNodeId: root.nodes[0].id,
      nodes: [createNode({ id: "inner_start", title: "Start", position: { x: 0, y: 0 } })],
      edges: [],
    });
    root.nodes[0].subgraphId = childId;
    const graphs = { ...created.graphs, [childId]: child };
    const fs = createMemoryFs();
    const saved = await saveProject(fs, "/stories/harbor", created.project, graphs, "2026-03-01T00:00:00.000Z");
    const loaded = await loadProject(fs, "/stories/harbor");

    expect(saved.updatedAt).toBe("2026-03-01T00:00:00.000Z");
    expect(loaded.project).toEqual(saved);
    expect(loaded.graphs).toEqual(graphs);
    expect(fs.dump()["/stories/harbor/project.json"]).toContain(`"schemaVersion": ${SCHEMA_VERSION}`);
    expect(fs.dump()[`/stories/harbor/graphs/${root.id}.json`]).toBeTruthy();
    expect(fs.dump()["/stories/harbor/graphs/graph_child.json"]).toContain("Inner");
  });

  it("drops graph files that are no longer in the project", async () => {
    const created = createNewProject("Harbor", "2026-01-01T00:00:00.000Z");
    const fs = createMemoryFs();
    await saveProject(fs, "/stories/harbor", created.project, created.graphs, "2026-03-01T00:00:00.000Z");
    await fs.writeText("/stories/harbor/graphs/orphan.json", "{}\n");
    await saveProject(fs, "/stories/harbor", created.project, created.graphs, "2026-03-02T00:00:00.000Z");
    expect(fs.dump()["/stories/harbor/graphs/orphan.json"]).toBeUndefined();
  });

  it("bundles every graph into one document", () => {
    const created = createNewProject("Harbor", "2026-01-01T00:00:00.000Z");
    const extra = createGraph({
      id: "graph_extra",
      name: "Extra",
      nodes: [createNode({ id: "end", title: "End" })],
      edges: [createEdge("missing", "end")],
    });
    const graphs = { ...created.graphs, [extra.id]: extra };
    const bundle = bundleProject(created.project, graphs, "2026-04-01T00:00:00.000Z");
    expect(bundle.kind).toBe("storyplanner.bundle");
    expect(bundle.schemaVersion).toBe(SCHEMA_VERSION);
    expect(bundle.graphs.map((graph) => graph.id).sort()).toEqual(
      Object.keys(graphs).sort(),
    );
    expect(bundle.project.name).toBe("Harbor");
  });
});
