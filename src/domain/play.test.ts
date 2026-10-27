import { describe, expect, it } from "vitest";
import {
  availableActions,
  chooseStart,
  createPlayState,
  jumpTo,
  performAction,
  reconcilePlay,
  setPlayValue,
  startChoices,
  stepBack,
} from "./play";
import { buildSample } from "./sample";
import type { PlayAction, PlayState } from "./play";

const { project, graphs } = buildSample();

function openPlay(): PlayState {
  const state = createPlayState(project, graphs);
  expect(state.choosingGraphId).toBe(project.rootGraphId);
  return chooseStart(state, graphs, "node_root_start", project.variables);
}

function enterChild(state: PlayState, graphId: string, nodeId: string): PlayState {
  expect(state.choosingGraphId).toBe(graphId);
  return chooseStart(state, graphs, nodeId, project.variables);
}

function take(state: PlayState, label: string): PlayState {
  const action = availableActions(state, project, graphs).find((item) => item.label === label && item.enabled);
  expect(action, label).toBeTruthy();
  return performAction(state, action as PlayAction, project, graphs);
}

function labels(state: PlayState, enabledOnly = false): string[] {
  return availableActions(state, project, graphs)
    .filter((action) => !enabledOnly || action.enabled)
    .map((action) => `${action.enabled ? "" : "off:"}${action.label}`);
}

describe("play-through", () => {
  it("disables the token transition until hasToken is set, and spends gold on entering the bribe", () => {
    let state = openPlay();
    state = take(state, "Approach the gate");
    expect(labels(state)).toContain("Open");
    expect(labels(state, true)).toContain("Leave");
    expect(labels(state, true)).not.toContain("Enter the walls");

    state = take(state, "Open");
    state = enterChild(state, "graph_approach", "node_ap_start");
    state = take(state, "At the gate");
    const atGate = labels(state);
    expect(atGate).toContain("off:Show the lantern token");
    expect(atGate).toContain("Offer a coin");
    expect(atGate).toContain("Ask about the old road");
    expect(atGate).toContain("Turn back");

    state = setPlayValue(state, "var_has_token", true);
    expect(labels(state, true)).toContain("Show the lantern token");

    state = take(state, "Offer a coin");
    expect(state.values.var_gold).toBe(4);
    expect(state.values.var_location).toBe("tag_loc_inside");
    expect(state.log.at(-1)).toBe("The bribe");

    expect(labels(state)).toEqual(["Crossing", "Return"]);
    state = take(state, "Crossing");
    expect(state.values.var_gold).toBe(4);

    state = take(state, "Return");
    const back = labels(state, true);
    expect(back).toContain("Enter the walls");
    expect(back).not.toContain("Leave");
  });

  it("does not follow a transition whose condition fails", () => {
    let state = openPlay();
    state = take(state, "Approach the gate");
    state = take(state, "Open");
    state = enterChild(state, "graph_approach", "node_ap_start");
    state = take(state, "At the gate");
    const blocked = availableActions(state, project, graphs).find((action) => action.label === "Show the lantern token");
    expect(blocked?.enabled).toBe(false);
    const stayed = performAction(state, blocked as PlayAction, project, graphs);
    expect(stayed.values.var_convinced).toBe(false);
    expect(stayed.log.at(-1)).toBe("At the gate");
  });
});

describe("transition actions", () => {
  it("describes the target and the condition, and leaves effects on the beat that is entered", () => {
    let state = openPlay();
    state = take(state, "Approach the gate");
    state = take(state, "Open");
    state = enterChild(state, "graph_approach", "node_ap_start");
    state = take(state, "At the gate");
    const coin = availableActions(state, project, graphs).find((action) => action.label === "Offer a coin");
    expect(coin?.kind).toBe("transition");
    expect(coin?.target).toBe("The bribe");
    expect(coin?.condition).toContain("gold ≥ 1");
    expect(coin).not.toHaveProperty("effects");
    const bribe = graphs.graph_approach.nodes.find((node) => node.id === "node_ap_bribe");
    expect(bribe?.effects.map((effect) => effect.id)).toEqual(["fx_coin_gold", "fx_coin_location"]);
  });
});

describe("choosing a start", () => {
  it("waits, then enters whichever beat was picked", () => {
    const waiting = createPlayState(project, graphs);
    expect(waiting.frames).toEqual([]);
    expect(waiting.choosingGraphId).toBe("graph_root");
    const hill = chooseStart(waiting, graphs, "node_root_hill", project.variables);
    expect(hill.choosingGraphId).toBeNull();
    expect(hill.log).toEqual(["From the hill"]);
    const next = take(hill, "Word of the gate");
    expect(next.log.at(-1)).toBe("Word of the gate");
    expect(labels(next, true)).toContain("Come up to the gate");
  });

  it("still waits when a graph has one beat with no incoming edge", () => {
    const approach = graphs.graph_approach;
    const state = createPlayState({ ...project, rootGraphId: approach.id }, graphs);
    expect(state.choosingGraphId).toBe(approach.id);
    expect(state.frames).toEqual([]);
    const entered = chooseStart(state, graphs, "node_ap_start", project.variables);
    expect(entered.frames).toEqual([{ graphId: approach.id, nodeId: "node_ap_start" }]);
  });

  it("can enter a beat that already has an incoming transition", () => {
    const state = createPlayState(project, graphs);
    const entered = chooseStart(state, graphs, "node_root_approach", project.variables);
    expect(entered.frames).toEqual([{ graphId: "graph_root", nodeId: "node_root_approach" }]);
    expect(entered.choosingGraphId).toBeNull();
  });
});

describe("play history", () => {
  it("steps back and jumps to an earlier beat", () => {
    let state = openPlay();
    state = take(state, "Approach the gate");
    state = take(state, "Open");
    state = enterChild(state, "graph_approach", "node_ap_start");
    state = take(state, "At the gate");
    state = take(state, "Offer a coin");
    expect(state.values.var_gold).toBe(4);

    const back = stepBack(state);
    expect(back.log.at(-1)).toBe("At the gate");
    expect(back.values.var_gold).not.toBe(4);

    const jumped = jumpTo(state, 1);
    expect(jumped.log).toEqual(state.log.slice(0, 2));
    expect(jumped.frames).toEqual([{ graphId: "graph_root", nodeId: "node_root_approach" }]);
    expect(jumped.choosingGraphId).toBeNull();
    expect(jumpTo(state, state.log.length - 1)).toBe(state);
  });

  it("shows the first failing clause of a blocked transition", () => {
    let state = openPlay();
    state = take(state, "Approach the gate");
    const blocked = availableActions(state, project, graphs).find((action) => !action.enabled);
    expect(blocked?.failed).toBeTruthy();
  });

  it("offers only entry beats inside a sub-graph", () => {
    const approach = graphs.graph_approach;
    const choices = startChoices(approach, false).map((node) => node.id);
    expect(choices).toContain("node_ap_start");
    expect(choices.length).toBeLessThan(approach.nodes.length);
    expect(startChoices(graphs[project.rootGraphId], true)).toHaveLength(graphs[project.rootGraphId].nodes.length);
  });

  it("keeps its place after edits and starts over when the beat is gone", () => {
    let state = openPlay();
    state = take(state, "Approach the gate");
    expect(reconcilePlay(state, project, graphs)).toBe(state);

    const extra = { ...project, variables: [...project.variables, { ...project.variables[0], id: "var_new" }] };
    const kept = reconcilePlay(state, extra, graphs);
    expect(kept.frames).toEqual(state.frames);
    expect("var_new" in kept.values).toBe(true);

    const root = graphs[project.rootGraphId];
    const edited = {
      ...graphs,
      [root.id]: { ...root, nodes: root.nodes.filter((node) => node.id !== "node_root_approach") },
    };
    const fresh = reconcilePlay(state, project, edited);
    expect(fresh.frames).toEqual([]);
    expect(fresh.choosingGraphId).toBe(project.rootGraphId);
  });
});
