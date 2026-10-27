import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "./factories";
import { indexInvolved, involvement } from "./involved";
import { MULTI_LOCATION, placementLocationId, UNPLACED_LOCATION } from "./locations";
import { buildSample } from "./sample";

describe("involvement", () => {
  const { graphs } = buildSample();

  it("unions a beat's own references with every nested beat, and does not flow downward", () => {
    const index = indexInvolved(graphs);
    const approach = involvement(index, "graph_root", "node_root_approach");
    expect(approach.own.locationIds).toEqual(["tag_loc_gate"]);
    expect(approach.all.locationIds).toEqual(["tag_loc_gate", "tag_loc_road", "tag_loc_inside"]);
    expect(approach.inherited.locationIds).toEqual(["tag_loc_road", "tag_loc_inside"]);
    expect(approach.all.characterIds).toEqual(expect.arrayContaining(["tag_traveler", "tag_gatekeeper"]));
    expect(approach.own.characterIds).toEqual([]);

    const downhill = involvement(index, "graph_approach", "node_ap_downhill");
    expect(downhill.own.characterIds).toEqual(["tag_gatekeeper", "tag_traveler"]);
    expect(downhill.inherited.characterIds).toEqual([]);
    const roadEnd = involvement(index, "graph_approach", "node_ap_end_road");
    expect(roadEnd.all).toEqual({ locationIds: ["tag_loc_road"], characterIds: [], itemIds: [] });
    expect(roadEnd.inherited).toEqual({ locationIds: [], characterIds: [], itemIds: [] });
  });

  it("stops when a sub-graph cycle stops growing", () => {
    const a = createNode({ id: "a", locationId: "L1", subgraphId: "gb" });
    const b = createNode({ id: "b", locationId: "L2", characterIds: ["C"], subgraphId: "ga" });
    const graphs = {
      ga: createGraph({ id: "ga", name: "A", nodes: [a], edges: [] }),
      gb: createGraph({ id: "gb", name: "B", nodes: [b], edges: [] }),
    };
    const index = indexInvolved(graphs);
    expect(involvement(index, "ga", "a").all.locationIds.sort()).toEqual(["L1", "L2"]);
    expect(involvement(index, "gb", "b").all.characterIds).toEqual(["C"]);
  });

  it("places a beat by its own location, else one inherited location", () => {
    const bare = createNode({ id: "bare" });
    expect(placementLocationId(bare, [])).toBe(UNPLACED_LOCATION);
    expect(placementLocationId(bare, ["loc_a"])).toBe("loc_a");
    expect(placementLocationId(bare, ["loc_a", "loc_b"])).toBe(MULTI_LOCATION);
    expect(placementLocationId({ ...bare, locationId: "loc_own" }, ["loc_a", "loc_b"])).toBe("loc_own");
  });
});
