import { describe, expect, it } from "vitest";
import { addableNodeTypes } from "./graphOps";
import { buildSample } from "./sample";

describe("addableNodeTypes", () => {
  const { project, graphs } = buildSample();
  const root = graphs[project.rootGraphId];

  it("omits start when the graph already has one", () => {
    expect(addableNodeTypes(root)).toEqual(["event", "scene", "dialogue", "end"]);
  });

  it("offers start first when the graph has none", () => {
    const empty = { ...root, nodes: root.nodes.filter((node) => node.type !== "start") };
    expect(addableNodeTypes(empty)).toEqual(["start", "event", "scene", "dialogue", "end"]);
  });
});
