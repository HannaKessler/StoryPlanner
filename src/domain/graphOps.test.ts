import { describe, expect, it } from "vitest";
import { parallelOffset, transitionCurve } from "./edgeGeometry";
import { createEdge, createGraph, createNode } from "./factories";
import { addableNodeTypes, graphBreadcrumbs, graphWarning, splitTransition } from "./graphOps";
import { beatLabel } from "./labels";
import { buildSample } from "./sample";

describe("addableNodeTypes", () => {
  const { project, graphs } = buildSample();
  const root = graphs[project.rootGraphId];

  it("lists every beat type, including start", () => {
    expect(addableNodeTypes()).toEqual(["start", "event", "scene", "dialogue", "end"]);
  });

  it("warns only when a graph has no start", () => {
    expect(graphWarning(root)).toBeNull();
    const empty = { ...root, nodes: root.nodes.filter((node) => node.type !== "start") };
    expect(graphWarning(empty)).toBe("This graph has no start.");
  });
});

describe("splitTransition", () => {
  it("keeps the original conditions on the first leg and adds a plain second leg", () => {
    const source = createNode("event", { id: "a", title: "A", position: { x: 0, y: 0 } });
    const target = createNode("end", { id: "b", title: "B", position: { x: 200, y: 80 } });
    const edge = createEdge("a", "b", {
      id: "ab",
      label: "Go",
      condition: { type: "compare", variableId: "gold", op: "gte", value: 1 },
      effects: [{ id: "fx", variableId: "gold", op: "add", value: 1 }],
    });
    const graph = {
      schemaVersion: 2,
      id: "g",
      name: "G",
      parentGraphId: null,
      parentNodeId: null,
      sceneNotes: "",
      locationBoxes: [],
      nodes: [source, target],
      edges: [edge],
    };
    const next = splitTransition(graph, "ab", createNode("scene", { id: "mid" }), createEdge("mid", "b", { id: "mb", label: "nope" }));
    expect(next).not.toBeNull();
    const first = next!.edges.find((item) => item.id === "ab");
    const second = next!.edges.find((item) => item.id === "mb");
    const mid = next!.nodes.find((item) => item.id === "mid");
    expect(first).toMatchObject({ source: "a", target: "mid", label: "Go", condition: edge.condition, effects: edge.effects });
    expect(second).toMatchObject({ source: "mid", target: "b", label: "", condition: null, effects: [] });
    expect(mid?.position).toEqual({ x: 100, y: 40 });
    expect(next!.edges.map((item) => item.id)).toEqual(["ab", "mb"]);
  });

  it("leaves the graph alone when the edge is missing", () => {
    const { graphs, project } = buildSample();
    expect(splitTransition(graphs[project.rootGraphId], "missing", createNode("event"), createEdge("a", "b"))).toBeNull();
  });
});

describe("parallel transitions", () => {
  const edges = [
    { id: "one", source: "a", target: "b" },
    { id: "other", source: "b", target: "c" },
    { id: "two", source: "a", target: "b" },
  ];

  it("offsets only edges that share both beats", () => {
    expect(parallelOffset(edges, "other")).toBe(0);
    expect(parallelOffset([{ id: "solo", source: "a", target: "b" }], "solo")).toBe(0);
    expect(parallelOffset(edges, "one")).toBeLessThan(0);
    expect(parallelOffset(edges, "two")).toBeGreaterThan(0);
    expect(parallelOffset(edges, "one")).toBe(-parallelOffset(edges, "two"));
  });

  it("bows parallel curves apart without moving their ends", () => {
    const straight = transitionCurve(0, 0, 200, 0, "right", "left", 0);
    const bowed = transitionCurve(0, 0, 200, 0, "right", "left", 40);
    expect(straight.path.startsWith("M0,0 ")).toBe(true);
    expect(straight.path.endsWith(" 200,0")).toBe(true);
    expect(bowed.path.startsWith("M0,0 ")).toBe(true);
    expect(bowed.path.endsWith(" 200,0")).toBe(true);
    expect(bowed.path).not.toBe(straight.path);
    expect(bowed.labelY).not.toBe(straight.labelY);
  });
});

describe("untitled beats", () => {
  it("stores no generated title and labels from the first line", () => {
    const node = createNode("dialogue", {
      id: "node_dialogue_abcdef",
      lines: [{ id: "line", speakerTagId: "tag_traveler", text: "Yes well", direction: "" }],
    });
    expect(node.title).toBe("");
    const project = buildSample().project;
    expect(beatLabel(node, project)).toBe("Dialogue · Traveler: Yes well");
    expect(node.title).toBe("");
  });

  it("falls back to the type and a short id when a beat has no lines", () => {
    const node = createNode("event", { id: "node_event_123456" });
    expect(beatLabel(node)).toBe("Event · 123456");
  });

  it("names an untitled sub-graph from its parent beat without writing that name", () => {
    const node = createNode("scene", { id: "node_parent_99aabb", title: "" });
    const parent = createGraph({ id: "g", name: "Root", nodes: [node], edges: [] });
    const child = createGraph({
      id: "c",
      name: "",
      parentGraphId: "g",
      parentNodeId: node.id,
      nodes: [],
      edges: [],
    });
    const crumbs = graphBreadcrumbs({ g: parent, c: child }, "c");
    expect(crumbs.map((crumb) => crumb.name)).toEqual(["Root", "Scene · 99aabb"]);
    expect(child.name).toBe("");
    expect(node.title).toBe("");
  });
});
