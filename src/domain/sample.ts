import type { Condition, Effect, GraphDocument, ProjectDocument } from "./types";
import { migrationContext, parseGraph, parseProject } from "./schema";

const NOW = "2026-01-15T18:00:00.000Z";

function eq(variableId: string, value: boolean | number | string | null): Condition {
  return { type: "compare", variableId, op: "eq", value };
}

function cmp(
  variableId: string,
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte",
  value: boolean | number | string | null,
): Condition {
  return { type: "compare", variableId, op, value };
}

function effect(
  id: string,
  variableId: string,
  op: Effect["op"],
  value: Effect["value"],
): Effect {
  return { id, variableId, op, value };
}

function node(partial: Record<string, unknown> & { id: string }) {
  return { tagIds: [], locationPosition: null, ...partial };
}

/** The bundled sample story. Fixed ids so the folder on disk can match this builder. */
export function buildSample(): { project: ProjectDocument; graphs: Record<string, GraphDocument> } {
  const showToken: Condition = eq("var_has_token", true);
  const offerCoin: Condition = {
    type: "group",
    op: "and",
    children: [cmp("var_gold", "gte", 1), { type: "not", child: eq("var_convinced", true) }],
  };
  const enterWalls: Condition = {
    type: "group",
    op: "or",
    children: [eq("var_convinced", true), cmp("var_gold", "lt", 5)],
  };
  const oldRoad: Condition = {
    type: "group",
    op: "and",
    children: [eq("var_asked_road", true), eq("var_location", "tag_loc_road")],
  };
  const turnedAway: Condition = {
    type: "group",
    op: "and",
    children: [
      { type: "not", child: eq("var_convinced", true) },
      cmp("var_gold", "gte", 5),
      { type: "not", child: eq("var_asked_road", true) },
    ],
  };

  const project = {
    schemaVersion: 3,
    id: "proj_lantern_gate",
    name: "The Lantern Gate",
    createdAt: NOW,
    updatedAt: NOW,
    rootGraphId: "graph_root",
    variables: [
      {
        id: "var_has_token",
        name: "hasToken",
        kind: "boolean",
        description: "The traveler is carrying a lantern token.",
        defaultValue: false,
        tagCategoryId: null,
      },
      {
        id: "var_convinced",
        name: "convinced",
        kind: "boolean",
        description: "The gatekeeper is willing to open the gate.",
        defaultValue: false,
        tagCategoryId: null,
      },
      {
        id: "var_asked_road",
        name: "askedRoad",
        kind: "boolean",
        description: "The traveler asked about the old road.",
        defaultValue: false,
        tagCategoryId: null,
      },
      {
        id: "var_gold",
        name: "gold",
        kind: "value",
        description: "Coins in the traveler's purse.",
        defaultValue: 5,
        tagCategoryId: null,
      },
      {
        id: "var_location",
        name: "location",
        kind: "tag",
        description: "Where the traveler is headed.",
        defaultValue: "tag_loc_gate",
        tagCategoryId: "cat_locations",
      },
    ],
    tagCategories: [
      {
        id: "cat_characters",
        name: "Characters",
        isCharacters: true,
        isLocations: false,
        description: "People who speak.",
        tags: [
          { id: "tag_traveler", name: "Traveler", description: "The player character.", color: "#e3a15a" },
          { id: "tag_gatekeeper", name: "Gatekeeper", description: "Keeps the night gate.", color: "#8eb4c8" },
        ],
      },
      {
        id: "cat_locations",
        name: "Locations",
        isCharacters: false,
        isLocations: true,
        description: "Places the story can name.",
        tags: [
          { id: "tag_loc_gate", name: "The Lantern Gate", description: "", color: "#9cba92" },
          { id: "tag_loc_road", name: "The Old Road", description: "", color: "#b7a4d6" },
          { id: "tag_loc_inside", name: "Inside the Walls", description: "", color: "#d4897a" },
        ],
      },
      {
        id: "cat_items",
        name: "Items",
        isCharacters: false,
        isLocations: false,
        description: "Things a character can carry or mention.",
        tags: [{ id: "tag_item_token", name: "Lantern Token", description: "Older than the lock.", color: "#e3a15a" }],
      },
    ],
  };

  const root = {
    schemaVersion: 3,
    id: "graph_root",
    name: "The Lantern Gate",
    parentGraphId: null,
    parentNodeId: null,
    sceneNotes: "A shut gate, two iron lanterns, and a choice about how the night goes.",
    locationBoxes: [],
    nodes: [
      node({
        id: "node_root_start",
        type: "start",
        position: { x: 40, y: 240 },
        title: "Start",
        summary: "",
        sceneNotes: "",
        subgraphId: null,
        lines: [],
      }),
      node({
        id: "node_root_approach",
        type: "event",
        position: { x: 320, y: 200 },
        title: "Approach the gate",
        summary: "The traveler reaches the shut gate and has to talk their way onward.",
        sceneNotes: "Night rain on the east road. Two iron lanterns burn beside the gate.",
        subgraphId: "graph_approach",
        lines: [],
      }),
      node({
        id: "node_root_inside",
        type: "event",
        position: { x: 760, y: 40 },
        title: "Inside the walls",
        summary: "The gate closes behind the traveler.",
        sceneNotes: "Wet stone and a quieter dark.",
        subgraphId: "graph_inside",
        lines: [],
      }),
      node({
        id: "node_root_road",
        type: "event",
        position: { x: 760, y: 250 },
        title: "The old road",
        summary: "The traveler leaves the gate and follows the lanterns downhill.",
        sceneNotes: "The stones are slick and the lanterns thin out.",
        subgraphId: null,
        lines: [],
      }),
      node({
        id: "node_root_turned",
        type: "end",
        position: { x: 760, y: 460 },
        title: "Turned away",
        summary: "The gate stays shut. The night keeps the traveler.",
        sceneNotes: "Rain, and the road back.",
        subgraphId: null,
        lines: [],
      }),
      node({
        id: "node_root_hill",
        type: "start",
        position: { x: 40, y: 560 },
        title: "From the hill",
        summary: "",
        sceneNotes: "",
        subgraphId: null,
        lines: [],
      }),
      node({
        id: "node_root_word",
        type: "event",
        position: { x: 320, y: 540 },
        title: "Word of the gate",
        summary: "A traveler on the old road hears that the gate is shut.",
        sceneNotes: "The lanterns thin out. Someone ahead is walking up.",
        subgraphId: null,
        lines: [],
      }),
    ],
    edges: [
      {
        id: "edge_root_start",
        source: "node_root_start",
        target: "node_root_approach",
        label: "",
        condition: null,
        effects: [],
      },
      {
        id: "edge_root_inside",
        source: "node_root_approach",
        target: "node_root_inside",
        label: "Enter the walls",
        condition: enterWalls,
        effects: [],
      },
      {
        id: "edge_root_road",
        source: "node_root_approach",
        target: "node_root_road",
        label: "Take the old road",
        condition: oldRoad,
        effects: [],
      },
      {
        id: "edge_root_turned",
        source: "node_root_approach",
        target: "node_root_turned",
        label: "Leave",
        condition: turnedAway,
        effects: [],
      },
      {
        id: "edge_root_hill",
        source: "node_root_hill",
        target: "node_root_word",
        label: "",
        condition: null,
        effects: [],
      },
      {
        id: "edge_root_word",
        source: "node_root_word",
        target: "node_root_approach",
        label: "Come up to the gate",
        condition: null,
        effects: [],
      },
    ],
  };

  const approach = {
    schemaVersion: 3,
    id: "graph_approach",
    name: "At the gate",
    parentGraphId: "graph_root",
    parentNodeId: "node_root_approach",
    sceneNotes: "The conversation at the shut gate.",
    locationBoxes: [],
    nodes: [
      node({
        id: "node_ap_start",
        type: "start",
        position: { x: 40, y: 270 },
        title: "Start",
        summary: "",
        sceneNotes: "",
        subgraphId: null,
        lines: [],
      }),
      node({
        id: "node_ap_gate",
        type: "dialogue",
        position: { x: 300, y: 240 },
        title: "At the gate",
        summary: "",
        sceneNotes: "The gatekeeper does not open the shutter at first.",
        subgraphId: null,
        lines: [
          {
            id: "line_gate_1",
            speakerTagId: "tag_gatekeeper",
            text: "The gate is shut. What business have you past nightfall?",
            direction: "He does not lift the lantern.",
          },
          {
            id: "line_gate_2",
            speakerTagId: "tag_traveler",
            text: "I have walked since the east village.",
            direction: "",
          },
        ],
      }),
      node({
        id: "node_ap_token",
        type: "dialogue",
        position: { x: 760, y: -60 },
        title: "The token",
        summary: "",
        sceneNotes: "A small iron token, warm from the traveler's hand.",
        subgraphId: null,
        lines: [
          {
            id: "line_token_1",
            speakerTagId: "tag_gatekeeper",
            text: "That token is older than the lock. Come through.",
            direction: "",
          },
          {
            id: "line_token_2",
            speakerTagId: "tag_traveler",
            text: "Then I will not waste the night.",
            direction: "",
          },
        ],
      }),
      node({
        id: "node_ap_bribe",
        type: "dialogue",
        position: { x: 760, y: 200 },
        title: "The bribe",
        summary: "",
        sceneNotes: "The coin rings once on the stone sill.",
        subgraphId: null,
        lines: [
          {
            id: "line_bribe_1",
            speakerTagId: "tag_gatekeeper",
            text: "A coin spends faster than a reason. Go.",
            direction: "",
          },
          {
            id: "line_bribe_2",
            speakerTagId: "tag_traveler",
            text: "Spend it on a dry watch, then.",
            direction: "",
          },
        ],
      }),
      node({
        id: "node_ap_downhill",
        type: "dialogue",
        position: { x: 760, y: 460 },
        title: "Downhill",
        summary: "",
        sceneNotes: "The gatekeeper points past the lantern light.",
        subgraphId: null,
        lines: [
          {
            id: "line_down_1",
            speakerTagId: "tag_gatekeeper",
            text: "Follow the lanterns downhill. Do not leave the stones.",
            direction: "",
          },
          {
            id: "line_down_2",
            speakerTagId: "tag_traveler",
            text: "And if the lanterns go out?",
            direction: "",
          },
          {
            id: "line_down_3",
            speakerTagId: "tag_gatekeeper",
            text: "Then you are no longer on the road.",
            direction: "Quietly.",
          },
        ],
      }),
      node({
        id: "node_ap_cross",
        type: "dialogue",
        position: { x: 1160, y: 80 },
        title: "Crossing",
        summary: "",
        sceneNotes: "The gate begins to open onto wet stone.",
        subgraphId: null,
        lines: [
          {
            id: "line_cross_1",
            speakerTagId: "tag_gatekeeper",
            text: "Mind the step. The stones are slick.",
            direction: "",
          },
        ],
      }),
      node({
        id: "node_ap_end_granted",
        type: "end",
        position: { x: 1500, y: 90 },
        title: "Granted",
        summary: "The traveler is let through.",
        sceneNotes: "",
        subgraphId: null,
        lines: [],
      }),
      node({
        id: "node_ap_end_road",
        type: "end",
        position: { x: 1160, y: 470 },
        title: "The road taken",
        summary: "The traveler leaves the gate behind.",
        sceneNotes: "",
        subgraphId: null,
        lines: [],
      }),
      node({
        id: "node_ap_end_back",
        type: "end",
        position: { x: 760, y: 720 },
        title: "Back into the rain",
        summary: "The lanterns stay where they are.",
        sceneNotes: "The lanterns stay where they are.",
        subgraphId: null,
        lines: [],
      }),
    ],
    edges: [
      {
        id: "edge_ap_start",
        source: "node_ap_start",
        target: "node_ap_gate",
        label: "",
        condition: null,
        effects: [],
      },
      {
        id: "edge_ap_token",
        source: "node_ap_gate",
        target: "node_ap_token",
        label: "Show the lantern token",
        condition: showToken,
        effects: [
          effect("fx_token_convinced", "var_convinced", "set", true),
          effect("fx_token_location", "var_location", "set", "tag_loc_inside"),
        ],
      },
      {
        id: "edge_ap_road",
        source: "node_ap_gate",
        target: "node_ap_downhill",
        label: "Ask about the old road",
        condition: null,
        effects: [
          effect("fx_road_asked", "var_asked_road", "set", true),
          effect("fx_road_location", "var_location", "set", "tag_loc_road"),
        ],
      },
      {
        id: "edge_ap_coin",
        source: "node_ap_gate",
        target: "node_ap_bribe",
        label: "Offer a coin",
        condition: offerCoin,
        effects: [
          effect("fx_coin_gold", "var_gold", "add", -1),
          effect("fx_coin_location", "var_location", "set", "tag_loc_inside"),
        ],
      },
      {
        id: "edge_ap_back",
        source: "node_ap_gate",
        target: "node_ap_end_back",
        label: "Turn back",
        condition: null,
        effects: [],
      },
      {
        id: "edge_ap_token_cross",
        source: "node_ap_token",
        target: "node_ap_cross",
        label: "",
        condition: null,
        effects: [],
      },
      {
        id: "edge_ap_bribe_cross",
        source: "node_ap_bribe",
        target: "node_ap_cross",
        label: "",
        condition: null,
        effects: [],
      },
      {
        id: "edge_ap_cross_end",
        source: "node_ap_cross",
        target: "node_ap_end_granted",
        label: "",
        condition: null,
        effects: [],
      },
      {
        id: "edge_ap_down_end",
        source: "node_ap_downhill",
        target: "node_ap_end_road",
        label: "",
        condition: null,
        effects: [],
      },
    ],
  };

  const inside = {
    schemaVersion: 3,
    id: "graph_inside",
    name: "Within the walls",
    parentGraphId: "graph_root",
    parentNodeId: "node_root_inside",
    sceneNotes: "Beyond the gate.",
    locationBoxes: [],
    nodes: [
      node({
        id: "node_in_start",
        type: "start",
        position: { x: 40, y: 180 },
        title: "Start",
        summary: "",
        sceneNotes: "",
        subgraphId: null,
        lines: [],
      }),
      node({
        id: "node_in_court",
        type: "dialogue",
        position: { x: 320, y: 150 },
        title: "The courtyard",
        summary: "",
        sceneNotes: "Rain sounds farther off. The gate closes.",
        subgraphId: null,
        lines: [
          {
            id: "line_court_1",
            speakerTagId: "tag_traveler",
            text: "The rain sounds different in here.",
            direction: "",
          },
        ],
      }),
      node({
        id: "node_in_end",
        type: "end",
        position: { x: 680, y: 170 },
        title: "Settled",
        summary: "The night changes its sound.",
        sceneNotes: "",
        subgraphId: null,
        lines: [],
      }),
    ],
    edges: [
      {
        id: "edge_in_start",
        source: "node_in_start",
        target: "node_in_court",
        label: "",
        condition: null,
        effects: [],
      },
      {
        id: "edge_in_end",
        source: "node_in_court",
        target: "node_in_end",
        label: "",
        condition: null,
        effects: [],
      },
    ],
  };

  const locations: Record<string, string[]> = {
    node_root_start: ["tag_loc_gate"],
    node_root_approach: ["tag_loc_gate"],
    node_root_inside: ["tag_loc_inside"],
    node_root_road: ["tag_loc_road"],
    node_root_turned: ["tag_loc_gate", "tag_loc_road"],
    node_root_hill: ["tag_loc_road"],
    node_root_word: ["tag_loc_road"],
    node_ap_start: ["tag_loc_gate"],
    node_ap_gate: ["tag_loc_gate"],
    node_ap_token: ["tag_loc_gate"],
    node_ap_bribe: ["tag_loc_gate"],
    node_ap_downhill: ["tag_loc_road"],
    node_ap_cross: ["tag_loc_gate"],
    node_ap_end_granted: ["tag_loc_inside"],
    node_ap_end_road: ["tag_loc_road"],
    node_ap_end_back: ["tag_loc_gate"],
    node_in_start: ["tag_loc_inside"],
    node_in_court: ["tag_loc_inside"],
    node_in_end: ["tag_loc_inside"],
  };
  const place = <T extends { nodes: Array<{ id: string }> }>(graph: T) => ({
    ...graph,
    nodes: graph.nodes.map((item) => ({ ...item, tagIds: locations[item.id] ?? [] })),
  });

  const context = migrationContext(project);
  return {
    project: parseProject(project),
    graphs: {
      [root.id]: parseGraph(place(root), context),
      [approach.id]: parseGraph(place(approach), context),
      [inside.id]: parseGraph(place(inside), context),
    },
  };
}
