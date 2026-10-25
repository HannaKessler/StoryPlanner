import { describe, expect, it } from "vitest";
import { locationColumns, locationPlacement, primaryLocationId } from "./locations";
import { buildSample } from "./sample";

describe("location columns", () => {
  const { project, graphs } = buildSample();
  const root = graphs.graph_root;

  it("draws a beat with several location tags once, in the earliest column", () => {
    const turned = root.nodes.find((node) => node.id === "node_root_turned");
    expect(turned?.tagIds).toEqual(["tag_loc_gate", "tag_loc_road"]);
    expect(primaryLocationId(turned!, project)).toBe("tag_loc_gate");
    const columns = locationColumns(root, project);
    expect(columns.map((column) => column.name)).toEqual([
      "The Lantern Gate",
      "The Old Road",
      "Inside the Walls",
      "Unassigned",
    ]);
    expect(columns.find((column) => column.id === "tag_loc_gate")?.nodeIds).toContain("node_root_turned");
    expect(columns.find((column) => column.id === "tag_loc_road")?.nodeIds).not.toContain("node_root_turned");
    expect(columns.find((column) => column.id === "tag_loc_road")?.nodeIds).toEqual([
      "node_root_road",
      "node_root_word",
      "node_root_hill",
    ]);
  });

  it("places beats for the view without changing their saved positions", () => {
    const before = root.nodes.map((node) => ({ id: node.id, ...node.position }));
    const placed = locationPlacement(root, project);
    expect(root.nodes.map((node) => ({ id: node.id, ...node.position }))).toEqual(before);
    const approach = placed.get("node_root_approach");
    const inside = placed.get("node_root_inside");
    const road = placed.get("node_root_road");
    const start = placed.get("node_root_start");
    expect(approach && inside && road && start).toBeTruthy();
    expect(start!.x).toBe(approach!.x);
    expect(inside!.x).toBeGreaterThan(approach!.x);
    expect(road!.x).toBeGreaterThan(approach!.x);
    expect(road!.x).not.toBe(inside!.x);
    expect(approach).not.toEqual(root.nodes.find((node) => node.id === "node_root_approach")?.position);
  });
});
