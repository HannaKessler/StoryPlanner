import { describe, expect, it } from "vitest";
import { createEdge, createEffect, createEntity, createGraph, createLine, createNode, createVariable } from "./factories";
import { countEntityRefs, countVariableRefs, deleteEntity, deleteVariable, sanitizeReferences } from "./references";
import type { GraphDocument, ProjectDocument } from "./types";

function fixture() {
  const hero = createEntity({ id: "hero", name: "Hero" });
  const guard = createEntity({ id: "guard", name: "Guard" });
  const key = createEntity({ id: "key", name: "Key" });
  const gate = createEntity({ id: "gate", name: "Gate" });
  const project: ProjectDocument = {
    schemaVersion: 4,
    id: "p",
    name: "P",
    createdAt: "",
    updatedAt: "",
    rootGraphId: "root",
    variables: [
      createVariable("boolean", { id: "open", name: "open", defaultValue: false }),
      createVariable("character", { id: "leader", name: "leader", defaultValue: "hero" }),
      createVariable("inventory", { id: "bag", name: "bag", defaultValue: ["key"] }),
    ],
    characters: [hero, guard],
    items: [key],
    locations: [gate],
  };
  const a = createNode({
    id: "a",
    locationId: "gate",
    characterIds: ["hero", "guard"],
    itemIds: ["key"],
    lines: [createLine({ id: "l1", speakerId: "hero", text: "Hi" }), createLine({ id: "l2", speakerId: "guard", text: "Halt" })],
    effects: [
      createEffect({ id: "e1", variableId: "open", op: "set", value: true }),
      createEffect({ id: "e2", variableId: "bag", op: "add", value: "key" }),
    ],
  });
  const b = createNode({ id: "b" });
  const edge = createEdge("a", "b", {
    id: "ab",
    condition: {
      type: "group",
      op: "and",
      children: [
        { type: "compare", variableId: "open", op: "eq", value: true },
        { type: "group", op: "or", children: [{ type: "has", variableId: "bag", entityId: "key" }] },
        { type: "not", child: { type: "compare", variableId: "leader", op: "eq", value: "hero" } },
      ],
    },
  });
  const root = createGraph({ id: "root", name: "Root", nodes: [a, b], edges: [edge] });
  root.locationBoxes = [
    { id: "gate", position: { x: 0, y: 0 }, size: { width: 10, height: 10 } },
    { id: "unplaced", position: { x: 0, y: 0 }, size: { width: 10, height: 10 } },
  ];
  const graphs: Record<string, GraphDocument> = { root };
  return { project, graphs };
}

describe("entity deletion", () => {
  it("counts every place an entity is used", () => {
    const { project, graphs } = fixture();
    // node chip, speaker, variable default, NOT rule
    expect(countEntityRefs(project, graphs, "hero")).toBe(4);
    // node item, inventory default, effect, has rule
    expect(countEntityRefs(project, graphs, "key")).toBe(4);
    expect(countEntityRefs(project, graphs, "gate")).toBe(1);
    expect(countEntityRefs(project, graphs, "nobody")).toBe(0);
  });

  it("removes a character everywhere and turns its lines into narration", () => {
    const { project, graphs } = fixture();
    const next = deleteEntity(project, graphs, "character", "hero");
    const a = next.graphs.root.nodes[0];
    expect(next.project.characters.map((item) => item.id)).toEqual(["guard"]);
    expect(a.characterIds).toEqual(["guard"]);
    expect(a.lines.map((line) => line.speakerId)).toEqual([null, "guard"]);
    expect(next.project.variables.find((item) => item.id === "leader")?.defaultValue).toBeNull();
    const condition = next.graphs.root.edges[0].condition;
    expect(condition?.type === "group" && condition.children).toHaveLength(2);
    expect(countEntityRefs(next.project, next.graphs, "hero")).toBe(0);
  });

  it("removes an item from inventories, effects and has rules, collapsing empty groups", () => {
    const { project, graphs } = fixture();
    const next = deleteEntity(project, graphs, "item", "key");
    const a = next.graphs.root.nodes[0];
    expect(a.itemIds).toEqual([]);
    expect(a.effects.map((effect) => effect.id)).toEqual(["e1"]);
    expect(next.project.variables.find((item) => item.id === "bag")?.defaultValue).toEqual([]);
    const condition = next.graphs.root.edges[0].condition;
    expect(condition).toEqual({
      type: "group",
      op: "and",
      children: [
        { type: "compare", variableId: "open", op: "eq", value: true },
        { type: "not", child: { type: "compare", variableId: "leader", op: "eq", value: "hero" } },
      ],
    });
  });

  it("clears a location from beats and its saved layout box", () => {
    const { project, graphs } = fixture();
    const next = deleteEntity(project, graphs, "location", "gate");
    expect(next.graphs.root.nodes[0].locationId).toBeNull();
    expect(next.graphs.root.locationBoxes.map((box) => box.id)).toEqual(["unplaced"]);
  });

  it("leaves untouched graphs with the same identity", () => {
    const { project, graphs } = fixture();
    const next = deleteEntity(project, graphs, "location", "unused");
    expect(next.graphs).toBe(graphs);
  });
});

describe("variable deletion", () => {
  it("removes rules and effects that use the variable", () => {
    const { project, graphs } = fixture();
    expect(countVariableRefs(project, graphs, "open")).toBe(2);
    const next = deleteVariable(project, graphs, "open");
    expect(next.project.variables.map((item) => item.id)).toEqual(["leader", "bag"]);
    expect(next.graphs.root.nodes[0].effects.map((effect) => effect.id)).toEqual(["e2"]);
    const condition = next.graphs.root.edges[0].condition;
    expect(condition?.type === "group" && condition.children.map((child) => child.type)).toEqual(["group", "not"]);
  });

  it("drops the whole condition when nothing is left", () => {
    const { project, graphs } = fixture();
    let next = deleteVariable(project, graphs, "open");
    next = deleteVariable(next.project, next.graphs, "bag");
    next = deleteVariable(next.project, next.graphs, "leader");
    expect(next.graphs.root.edges[0].condition).toBeNull();
  });
});

describe("sanitize on load", () => {
  it("removes references that are already dangling", () => {
    const { project, graphs } = fixture();
    const broken = { ...project, characters: [project.characters[1]], variables: project.variables.filter((item) => item.id !== "open") };
    const result = sanitizeReferences(broken, graphs);
    expect(result.count).toBeGreaterThan(0);
    const a = result.graphs.root.nodes[0];
    expect(a.characterIds).toEqual(["guard"]);
    expect(a.lines[0].speakerId).toBeNull();
    expect(a.effects.map((effect) => effect.id)).toEqual(["e2"]);
    expect(sanitizeReferences(result.project, result.graphs).count).toBe(0);
  });

  it("changes nothing in a clean project", () => {
    const { project, graphs } = fixture();
    const result = sanitizeReferences(project, graphs);
    expect(result.count).toBe(0);
    expect(result.project).toBe(project);
    expect(result.graphs).toBe(graphs);
  });

  it("keeps blank rules that have not picked a variable yet", () => {
    const { project, graphs } = fixture();
    const root = graphs.root;
    const withBlank = { root: { ...root, edges: [{ ...root.edges[0], condition: { type: "compare" as const, variableId: "", op: "eq" as const, value: true } }] } };
    expect(sanitizeReferences(project, withBlank).graphs).toBe(withBlank);
  });
});
