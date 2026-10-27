import { describe, expect, it } from "vitest";
import { createEdge, createEffect, createGraph, createLine, createNode, createVariable } from "./factories";
import { buildSample } from "./sample";
import type { ProjectDocument } from "./types";
import { usedIn } from "./usedIn";

function setup() {
  const { project } = buildSample();
  const where = createVariable("location", { id: "var_where" });
  const bag = createVariable("inventory", { id: "var_bag" });
  const root = createGraph({ id: "root", name: "Root" });
  const sub = createGraph({ id: "sub", name: "Sub" });
  sub.parentGraphId = "root";
  sub.parentNodeId = "a";
  root.nodes = [
    createNode({ id: "a", title: "A", position: { x: 0, y: 0 }, locationId: "loc1", subgraphId: "sub" }),
    createNode({ id: "b", title: "B", position: { x: 100, y: 0 }, characterIds: ["hero"] }),
    createNode({ id: "c", title: "C", position: { x: 200, y: 0 }, effects: [createEffect({ variableId: "var_where", op: "set", value: "loc1" })] }),
  ];
  root.edges = [
    createEdge("a", "b"),
    createEdge("b", "c", { condition: { type: "has", variableId: "var_bag", entityId: "key" } }),
  ];
  sub.nodes = [createNode({ id: "s", title: "S", lines: [createLine({ speakerId: "hero" })], itemIds: ["key"] })];
  const doc: ProjectDocument = { ...project, rootGraphId: "root", variables: [where, bag] };
  return { project: doc, graphs: { root, sub } };
}

const ids = (list: ReturnType<typeof usedIn>) => list.map((entry) => `${entry.node.id}:${entry.ways.join("+")}`);

describe("used in", () => {
  it("lists beats with a location, including effects that set it, in outline order", () => {
    const { project, graphs } = setup();
    expect(ids(usedIn(project, graphs, "location", "loc1"))).toEqual(["a:location", "c:effect"]);
  });

  it("lists beats where a character is listed or speaks, inside sub-graphs too", () => {
    const { project, graphs } = setup();
    const list = usedIn(project, graphs, "character", "hero");
    expect(ids(list)).toEqual(["s:speaks", "b:listed"]);
    expect(list[0].graphId).toBe("sub");
  });

  it("lists beats that list an item or test it on a transition out", () => {
    const { project, graphs } = setup();
    expect(ids(usedIn(project, graphs, "item", "key"))).toEqual(["s:listed", "b:condition"]);
  });

  it("returns nothing for an unused entity", () => {
    const { project, graphs } = setup();
    expect(usedIn(project, graphs, "item", "nothing")).toEqual([]);
  });
});
