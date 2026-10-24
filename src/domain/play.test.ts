import { describe, expect, it } from "vitest";
import { availableActions, createPlayState, performAction, setPlayValue } from "./play";
import { buildSample } from "./sample";
import type { PlayAction, PlayState } from "./play";

const { project, graphs } = buildSample();

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
  it("hides the token choice until hasToken is set, and spends gold on a bribe", () => {
    let state = createPlayState(project, graphs);
    state = take(state, "Approach the gate");
    expect(labels(state)).toContain("Step into Approach the gate");
    expect(labels(state, true)).toContain("Leave");
    expect(labels(state, true)).not.toContain("Enter the walls");

    state = take(state, "Step into Approach the gate");
    state = take(state, "At the gate");
    const atGate = labels(state);
    expect(atGate).toContain("off:Show the lantern token");
    expect(atGate).toContain("Offer a coin");
    expect(atGate).toContain("Ask about the old road");

    state = setPlayValue(state, "var_has_token", true);
    expect(labels(state, true)).toContain("Show the lantern token");

    state = take(state, "Offer a coin");
    expect(state.values.var_gold).toBe(4);
    expect(state.values.var_location).toBe("tag_loc_inside");
    expect(state.log.at(-1)).toBe("The bribe");

    state = take(state, "Return");
    const back = labels(state, true);
    expect(back).toContain("Enter the walls");
    expect(back).not.toContain("Leave");
  });

  it("does not take a choice whose condition fails", () => {
    let state = createPlayState(project, graphs);
    state = take(state, "Approach the gate");
    state = take(state, "Step into Approach the gate");
    state = take(state, "At the gate");
    const blocked = availableActions(state, project, graphs).find((action) => action.label === "Show the lantern token");
    expect(blocked?.enabled).toBe(false);
    const stayed = performAction(state, blocked as PlayAction, project, graphs);
    expect(stayed.values.var_convinced).toBe(false);
    expect(stayed.log.at(-1)).toBe("At the gate");
  });
});
