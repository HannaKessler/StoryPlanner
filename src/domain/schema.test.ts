import { describe, expect, it } from "vitest";
import { buildSample } from "./sample";
import { SchemaError, migrationContext, parseBundle, parseGraph, parseProject } from "./schema";
import { bundleProject } from "./project";
import type { GraphDocument, StoryNode } from "./types";

describe("schema", () => {
  it("parses the sample project, including an unknown-friendly kind field", () => {
    const { project, graphs } = buildSample();
    const parsed = parseProject(structuredClone(project));
    expect(parsed).toEqual(project);
    expect(parsed.schemaVersion).toBe(4);
    expect(parseGraph(graphs.graph_approach)).toEqual(graphs.graph_approach);
    expect(graphs.graph_root.nodes.every((node) => node.type === "beat")).toBe(true);
    expect(graphs.graph_approach.edges.every((edge) => !("effects" in edge))).toBe(true);
  });

  it("rejects a newer schema version", () => {
    const { project } = buildSample();
    expect(() => parseProject({ ...project, schemaVersion: 5 })).toThrow(SchemaError);
    expect(() => parseProject({ ...project, schemaVersion: 5 })).toThrow(/schemaVersion 5/);
  });

  it("migrates a version 1 graph onto beats, and moves effects onto the target", () => {
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
    expect(graph.schemaVersion).toBe(4);
    expect(graph.nodes[0]).toMatchObject({ type: "beat", locationId: null, characterIds: [], itemIds: [], effects: [] });
    expect(graph.nodes[0]).not.toHaveProperty("choices");
    expect(graph.nodes[1].effects).toEqual([
      { id: "fx_enter", variableId: "var_convinced", op: "set", value: true },
      { id: "fx_pay", variableId: "var_gold", op: "add", value: -1 },
    ]);
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
      },
    ]);
  });

  it("migrates tags into characters, items, and locations, and keeps a location variable a location", () => {
    const project = {
      schemaVersion: 3,
      id: "p",
      name: "P",
      createdAt: "t",
      updatedAt: "t",
      rootGraphId: "g",
      variables: [
        {
          id: "var_location",
          name: "location",
          kind: "tag",
          description: "",
          defaultValue: "loc_a",
          tagCategoryId: "cat_loc",
        },
        {
          id: "var_bag",
          name: "bag",
          kind: "tag",
          description: "",
          defaultValue: "item_coin",
          tagCategoryId: "cat_inv",
        },
      ],
      tagCategories: [
        {
          id: "cat_char",
          name: "Characters",
          isCharacters: true,
          isLocations: false,
          description: "",
          tags: [{ id: "char_a", name: "Ada", description: "A person.", color: "#fff" }],
        },
        {
          id: "cat_loc",
          name: "Locations",
          isCharacters: false,
          isLocations: true,
          description: "",
          tags: [
            { id: "loc_a", name: "Gate", description: "", color: "" },
            { id: "loc_b", name: "Road", description: "", color: "" },
          ],
        },
        {
          id: "cat_odd",
          name: "Moods",
          isCharacters: false,
          isLocations: false,
          description: "How a scene feels.",
          tags: [{ id: "mood_wet", name: "Wet", description: "Damp.", color: "#abc" }],
        },
        {
          id: "cat_inv",
          name: "Inventory",
          isCharacters: false,
          isLocations: false,
          description: "",
          tags: [{ id: "item_coin", name: "Coin", description: "", color: "" }],
        },
      ],
    };
    const parsed = parseProject(project);
    expect(parsed.schemaVersion).toBe(4);
    expect(parsed).not.toHaveProperty("tagCategories");
    expect(parsed.characters.map((entity) => entity.id)).toEqual(["char_a"]);
    expect(parsed.characters[0]).toMatchObject({ notes: "A person.", fields: [{ key: "color", value: "#fff" }] });
    expect(parsed.locations.map((entity) => entity.name)).toEqual(["Gate", "Road"]);
    expect(parsed.items.map((entity) => entity.id)).toEqual(["mood_wet", "item_coin"]);
    expect(parsed.items[0].notes).toContain("Category: Moods");
    expect(parsed.items[0].notes).toContain("Damp.");
    expect(parsed.items[0].fields).toEqual([
      { key: "color", value: "#abc" },
      { key: "category", value: "Moods" },
    ]);
    expect(parsed.variables.map((variable) => [variable.id, variable.kind])).toEqual([
      ["var_location", "location"],
      ["var_bag", "inventory"],
    ]);
    expect(parsed.variables[0]).not.toHaveProperty("defaultValue");
    expect(parsed.variables[0]).not.toHaveProperty("tagCategoryId");

    const graph = {
      schemaVersion: 3,
      id: "g",
      name: "G",
      parentGraphId: null,
      parentNodeId: null,
      sceneNotes: "",
      nodes: [
        {
          id: "n",
          type: "scene",
          position: { x: 1, y: 2 },
          title: "Here",
          sceneNotes: "Rain.",
          tagIds: ["loc_a", "loc_b", "char_a", "mood_wet", "missing"],
          lines: [{ id: "l", speakerTagId: "char_a", text: "Hi", direction: "" }],
        },
        {
          id: "m",
          type: "end",
          position: { x: 3, y: 4 },
          title: "There",
          tagIds: [],
          lines: [],
          effects: [{ id: "fx_own", variableId: "var_location", op: "set", value: "loc_b" }],
        },
      ],
      edges: [
        {
          id: "e",
          source: "n",
          target: "m",
          label: "Go",
          condition: null,
          effects: [{ id: "fx_edge", variableId: "var_location", op: "set", value: "loc_a" }],
        },
      ],
      locationBoxes: [{ id: "unassigned", position: { x: 0, y: 0 }, size: { width: 10, height: 10 } }],
    };
    const parsedGraph = parseGraph(graph, migrationContext(project));
    expect(parsedGraph.schemaVersion).toBe(4);
    expect(parsedGraph.nodes[0]).toMatchObject({
      type: "beat",
      locationId: "loc_a",
      characterIds: ["char_a"],
      itemIds: ["mood_wet"],
      sceneNotes: "Rain.\nRoad, missing",
    });
    expect(parsedGraph.nodes[0].lines[0].speakerId).toBe("char_a");
    expect(parsedGraph.nodes[1].effects.map((effect) => effect.id)).toEqual(["fx_own", "fx_edge"]);
    expect(parsedGraph.edges[0]).not.toHaveProperty("effects");
    expect(parsedGraph.locationBoxes[0].id).toBe("unplaced");

    const bare = parseGraph({ ...graph, schemaVersion: 2, nodes: [{ ...graph.nodes[0], tagIds: undefined }], edges: [] });
    expect(bare.nodes[0].locationId).toBeNull();
    expect(bare.nodes[0].locationPosition).toBeNull();
  });

  it("preserves an unknown variable kind", () => {
    const { project } = buildSample();
    const withKind = structuredClone(project);
    withKind.variables.push({
      id: "var_future",
      name: "reputation",
      kind: "meter",
      description: "Added by a future version.",
    });
    expect(parseProject(withKind).variables.at(-1)?.kind).toBe("meter");
  });

  it("parses a bundle and keeps computed involvement out of the stored beats", () => {
    const { project, graphs } = buildSample();
    const bundle = bundleProject(project, graphs, "2026-02-01T00:00:00.000Z");
    const parsed = parseBundle(bundle);
    expect(parsed.project).toEqual(project);
    expect(parsed.graphs).toEqual(Object.values(graphs).sort((a, b) => a.id.localeCompare(b.id)));
    const approach = bundle.graphs.find((graph) => graph.id === "graph_root");
    const node = approach?.nodes.find((item) => item.id === "node_root_approach") as StoryNode & {
      involved?: { locationIds: string[] };
    };
    expect(node.involved?.locationIds).toEqual(["tag_loc_gate", "tag_loc_road", "tag_loc_inside"]);
    expect(parsed.graphs.every((graph: GraphDocument) => graph.nodes.every((item) => !("involved" in item)))).toBe(true);
    expect(() => parseBundle({ ...bundle, kind: "other" })).toThrow(/storyplanner.bundle/);
  });
});
