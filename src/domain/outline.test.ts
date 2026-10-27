import { describe, expect, it } from "vitest";
import { createEdge, createGraph, createNode } from "./factories";
import { ancestorKeys, buildOutline, orderBeats, outlineKey, visibleRows } from "./outline";
import { buildSample } from "./sample";

const at = (id: string, x: number, y: number) => createNode({ id, title: id, position: { x, y } });

describe("outline", () => {
  it("follows transitions depth-first from entry beats, then the rest by position", () => {
    const graph = createGraph({ id: "g", name: "G" });
    graph.nodes = [at("c", 400, 100), at("a", 0, 0), at("b", 200, 0), at("d", 400, 0), at("loose", 50, 300), at("x", 600, 0), at("y", 700, 0)];
    graph.edges = [createEdge("a", "b"), createEdge("b", "c"), createEdge("b", "d"), createEdge("x", "y"), createEdge("y", "x")];
    expect(orderBeats(graph).map((node) => node.id)).toEqual(["a", "b", "d", "c", "loose", "x", "y"]);
  });

  it("visits a beat once even when transitions loop back", () => {
    const graph = createGraph({ id: "g", name: "G" });
    graph.nodes = [at("a", 0, 0), at("b", 100, 0)];
    graph.edges = [createEdge("a", "b"), createEdge("b", "a")];
    expect(orderBeats(graph).map((node) => node.id)).toEqual(["a", "b"]);
  });

  it("nests sub-graphs under their beat and shows them only when expanded", () => {
    const { project, graphs } = buildSample();
    const tree = buildOutline(graphs, project.rootGraphId);
    const approach = tree.find((row) => row.node.id === "node_root_approach");
    expect(approach?.children?.length).toBe(graphs.graph_approach.nodes.length);
    expect(approach?.children?.[0].depth).toBe(1);
    expect(approach?.children?.[0].graphId).toBe("graph_approach");

    const collapsed = visibleRows(tree, new Set());
    expect(collapsed).toHaveLength(graphs[project.rootGraphId].nodes.length);
    const open = visibleRows(tree, new Set([approach!.key]));
    expect(open.length).toBe(collapsed.length + approach!.children!.length);
    expect(open[open.indexOf(approach!) + 1].graphId).toBe("graph_approach");
  });

  it("lists the beats that hold a graph, outermost first", () => {
    const { project, graphs } = buildSample();
    expect(ancestorKeys(graphs, project.rootGraphId)).toEqual([]);
    expect(ancestorKeys(graphs, "graph_approach")).toEqual([outlineKey(project.rootGraphId, "node_root_approach")]);
  });

  it("stops at a sub-graph that loops back to an outer graph", () => {
    const outer = createGraph({ id: "outer", name: "Outer" });
    const inner = createGraph({ id: "inner", name: "Inner" });
    outer.nodes = [createNode({ id: "o", subgraphId: "inner" })];
    inner.nodes = [createNode({ id: "i", subgraphId: "outer" })];
    const tree = buildOutline({ outer, inner }, "outer");
    expect(tree[0].children?.[0].children).toBeNull();
  });
});
