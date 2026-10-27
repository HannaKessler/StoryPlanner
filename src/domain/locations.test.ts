import { describe, expect, it } from "vitest";
import { locationFrames } from "./locations";
import { buildSample } from "./sample";

describe("location boxes", () => {
  const { project, graphs } = buildSample();
  const root = graphs.graph_root;

  it("draws a beat with its own location, and keeps an extra place in the notes", () => {
    const turned = root.nodes.find((node) => node.id === "node_root_turned");
    expect(turned?.locationId).toBe("tag_loc_gate");
    expect(turned?.sceneNotes).toContain("The Old Road");
    const frames = locationFrames(root, project, graphs);
    expect(frames.map((frame) => frame.name)).toEqual([
      "The Lantern Gate",
      "The Old Road",
      "Inside the Walls",
      "Unplaced",
    ]);
    const gate = frames.find((frame) => frame.id === "tag_loc_gate");
    const road = frames.find((frame) => frame.id === "tag_loc_road");
    expect(gate?.nodes.map((node) => node.id)).toContain("node_root_turned");
    expect(road?.nodes.map((node) => node.id)).not.toContain("node_root_turned");
    expect(road?.nodes.map((node) => node.id)).toEqual(["node_root_road", "node_root_word", "node_root_hill"]);
    const spots = frames.map((frame) => `${frame.position.x},${frame.position.y}`);
    expect(new Set(spots).size).toBe(frames.length);
    for (const frame of frames) {
      for (const node of frame.nodes) {
        expect(node.position.x).toBeGreaterThanOrEqual(0);
        expect(node.position.y).toBeGreaterThanOrEqual(0);
        expect(node.position.x).toBeLessThan(frame.size.width);
        expect(node.position.y).toBeLessThan(frame.size.height);
      }
    }
  });

  it("uses a saved box layout without changing graph positions", () => {
    const before = root.nodes.map((node) => ({ id: node.id, ...node.position }));
    locationFrames(root, project);
    expect(root.nodes.map((node) => ({ id: node.id, ...node.position }))).toEqual(before);

    const hill = root.nodes.find((node) => node.id === "node_root_hill")!;
    const moved = {
      ...root,
      locationBoxes: [{ id: "tag_loc_road", position: { x: 900, y: 240 }, size: { width: 800, height: 700 } }],
      nodes: root.nodes.map((node) => (node.id === hill.id ? { ...node, locationPosition: { x: 40, y: 300 } } : node)),
    };
    const frames = locationFrames(moved, project, graphs);
    const road = frames.find((frame) => frame.id === "tag_loc_road");
    expect(road?.position).toEqual({ x: 900, y: 240 });
    expect(road?.size.width).toBe(800);
    expect(road?.size.height).toBeGreaterThanOrEqual(700);
    expect(road?.nodes.find((node) => node.id === hill.id)?.position).toEqual({ x: 40, y: 300 });
    expect(moved.nodes.find((node) => node.id === hill.id)?.position).toEqual(hill.position);
    const approach = frames.find((frame) => frame.id === "tag_loc_gate");
    const approachNode = approach?.nodes.find((node) => node.id === "node_root_approach");
    expect(approachNode?.position).not.toEqual(root.nodes.find((node) => node.id === "node_root_approach")?.position);
  });
});
