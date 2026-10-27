import { describe, expect, it } from "vitest";
import { assigned, assignPatch, unassignPatch } from "./assign";
import { createNode } from "./factories";

describe("assigning entities to an event", () => {
  const node = createNode({ characterIds: ["hero"], itemIds: ["key"], locationId: "gate" });

  it("adds once, sets the location, and removes", () => {
    expect(assignPatch(node, "character", "guard")).toEqual({ characterIds: ["hero", "guard"] });
    expect(assignPatch(node, "character", "hero")).toEqual({ characterIds: ["hero"] });
    expect(assignPatch(node, "location", "road")).toEqual({ locationId: "road" });
    expect(unassignPatch(node, "item", "key")).toEqual({ itemIds: [] });
    expect(unassignPatch(node, "location", "gate")).toEqual({ locationId: null });
    expect(unassignPatch(node, "location", "road")).toEqual({ locationId: "gate" });
  });

  it("knows what the event lists itself", () => {
    expect(assigned(node, "character", "hero")).toBe(true);
    expect(assigned(node, "character", "guard")).toBe(false);
    expect(assigned(node, "location", "gate")).toBe(true);
  });
});
