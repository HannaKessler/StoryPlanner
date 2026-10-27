import { describe, expect, it } from "vitest";
import { errorMessage } from "../desktop/tauri";
import { createGraph, createNode } from "./factories";
import { nextBeatPosition } from "./graphOps";
import { clip, plural } from "./labels";

describe("labels", () => {
  it("pluralises counts", () => {
    expect(plural(1, "beat")).toBe("1 beat");
    expect(plural(0, "beat")).toBe("0 beats");
    expect(plural(3, "transition")).toBe("3 transitions");
  });

  it("clips long labels for menus", () => {
    expect(clip("short")).toBe("short");
    const long = clip("x".repeat(80));
    expect(long.length).toBe(40);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("error messages", () => {
  it("maps system errors to short text", () => {
    expect(errorMessage("The system cannot find the path specified. (os error 3)")).toBe("File or folder not found.");
    expect(errorMessage(new Error("Access is denied. (os error 5)"))).toBe("Permission denied.");
    expect(errorMessage("Something odd (os error 999)")).toBe("Something odd");
    expect(errorMessage(null)).toBe("Something went wrong.");
  });
});

describe("new beat placement", () => {
  const graph = createGraph({ name: "" });
  graph.nodes = [createNode({ id: "a", position: { x: 100, y: 100 } }), createNode({ id: "b", position: { x: 380, y: 100 } })];

  it("goes right of the selected beat and below anything already there", () => {
    expect(nextBeatPosition(graph, "a")).toEqual({ x: 380, y: 190 });
    expect(nextBeatPosition(graph, "b")).toEqual({ x: 660, y: 100 });
  });

  it("goes in the middle of the view when nothing is selected", () => {
    expect(nextBeatPosition(graph, null, { x: 1000, y: 500 })).toEqual({ x: 885, y: 470 });
  });

  it("goes right of the rightmost beat without a view", () => {
    expect(nextBeatPosition(graph, null)).toEqual({ x: 660, y: 140 });
  });
});
