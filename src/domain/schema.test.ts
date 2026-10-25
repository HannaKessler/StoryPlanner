import { describe, expect, it } from "vitest";
import { buildSample } from "./sample";
import { SchemaError, parseBundle, parseGraph, parseProject } from "./schema";
import { bundleProject } from "./project";

describe("schema", () => {
  it("parses the sample project, including an unknown-friendly kind field", () => {
    const { project, graphs } = buildSample();
    const parsed = parseProject(structuredClone(project));
    expect(parsed).toEqual(project);
    expect(parseGraph(graphs.graph_approach)).toEqual(graphs.graph_approach);
  });

  it("rejects a newer schema version", () => {
    const { project } = buildSample();
    expect(() => parseProject({ ...project, schemaVersion: 4 })).toThrow(SchemaError);
    expect(() => parseProject({ ...project, schemaVersion: 4 })).toThrow(/schemaVersion 4/);
  });

  it("migrates a version 1 graph: choices and on-enter effects move onto edges", () => {
    const v1 = {
      schemaVersion: 1,
      id: "g",
      name: "Old",
      parentGraphId: null,
      parentNodeId: null,
      sceneNotes: "",
      nodes: [
        {
          id: "talk",
          type: "dialogue",
          position: { x: 0, y: 0 },
          title: "Talk",
          lines: [],
          choices: [
            {
              id: "ch_pay",
              label: "Pay",
              condition: { type: "compare", variableId: "var_gold", op: "gte", value: 1 },
              effects: [{ id: "fx_pay", variableId: "var_gold", op: "add", value: -1 }],
            },
            { id: "ch_loose", label: "Never connected", condition: null, effects: [] },
          ],
          effects: [],
        },
        {
          id: "paid",
          type: "scene",
          position: { x: 200, y: 0 },
          title: "Paid",
          lines: [],
          choices: [],
          effects: [{ id: "fx_enter", variableId: "var_convinced", op: "set", value: true }],
        },
      ],
      edges: [
        {
          id: "e1",
          source: "talk",
          target: "paid",
          choiceId: "ch_pay",
          label: "",
          condition: { type: "compare", variableId: "var_asked_road", op: "eq", value: false },
        },
      ],
    };
    const graph = parseGraph(v1);
    expect(graph.schemaVersion).toBe(3);
    expect(graph.nodes[0]).not.toHaveProperty("choices");
    expect(graph.nodes[0]).toMatchObject({ tagIds: [] });
    expect(graph.nodes[1]).not.toHaveProperty("effects");
    expect(graph.edges).toEqual([
      {
        id: "e1",
        source: "talk",
        target: "paid",
        label: "Pay",
        condition: {
          type: "group",
          op: "and",
          children: [
            { type: "compare", variableId: "var_gold", op: "gte", value: 1 },
            { type: "compare", variableId: "var_asked_road", op: "eq", value: false },
          ],
        },
        effects: [
          { id: "fx_pay", variableId: "var_gold", op: "add", value: -1 },
          { id: "e1:fx_enter", variableId: "var_convinced", op: "set", value: true },
        ],
      },
    ]);
    expect(parseProject({ ...buildSample().project, schemaVersion: 1 }).schemaVersion).toBe(3);
  });

  it("migrates a version 2 graph: beats gain tag ids and categories gain the locations flag", () => {
    const { project, graphs } = buildSample();
    const category = { ...project.tagCategories[1] };
    delete (category as { isLocations?: boolean }).isLocations;
    const node = { ...graphs.graph_root.nodes[0] };
    delete (node as { tagIds?: string[] }).tagIds;
    const parsedProject = parseProject({ ...project, schemaVersion: 2, tagCategories: [category] });
    expect(parsedProject.schemaVersion).toBe(3);
    expect(parsedProject.tagCategories[0].isLocations).toBe(false);
    const parsedGraph = parseGraph({
      ...graphs.graph_root,
      schemaVersion: 2,
      nodes: [node],
      edges: [],
    });
    expect(parsedGraph.schemaVersion).toBe(3);
    expect(parsedGraph.nodes[0].tagIds).toEqual([]);
    expect(parsedGraph.nodes[0].id).toBe(node.id);
    const bare = { ...graphs.graph_root, schemaVersion: 2 as const, nodes: [{ ...node }], edges: [] };
    delete (bare as { locationBoxes?: unknown }).locationBoxes;
    delete (bare.nodes[0] as { locationPosition?: unknown }).locationPosition;
    const defaults = parseGraph(bare);
    expect(defaults.locationBoxes).toEqual([]);
    expect(defaults.nodes[0].locationPosition).toBeNull();
  });

  it("preserves an unknown variable kind", () => {
    const { project } = buildSample();
    const withKind = structuredClone(project);
    withKind.variables.push({
      id: "var_future",
      name: "reputation",
      kind: "meter",
      description: "Added by a future version.",
      defaultValue: "steady",
      tagCategoryId: null,
    });
    expect(parseProject(withKind).variables.at(-1)?.kind).toBe("meter");
  });

  it("rejects a boolean variable with a numeric default", () => {
    const { project } = buildSample();
    const broken = structuredClone(project);
    broken.variables[0].defaultValue = 1;
    expect(() => parseProject(broken)).toThrow(/boolean/);
  });

  it("parses a bundle and checks its kind", () => {
    const { project, graphs } = buildSample();
    const bundle = bundleProject(project, graphs, "2026-02-01T00:00:00.000Z");
    expect(parseBundle(bundle)).toEqual(bundle);
    expect(() => parseBundle({ ...bundle, kind: "other" })).toThrow(/storyplanner.bundle/);
  });
});
