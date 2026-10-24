import { describe, expect, it } from "vitest";
import { describeCondition, evaluateCondition } from "./conditions";
import { applyEffect, applyEffects } from "./effects";
import { buildSample } from "./sample";
import type { Condition, Effect } from "./types";

const { project } = buildSample();
const variables = project.variables;

function values(patch: Record<string, boolean | number | string | null> = {}) {
  return {
    var_has_token: false,
    var_convinced: false,
    var_asked_road: false,
    var_gold: 5,
    var_location: "tag_loc_gate",
    ...patch,
  };
}

describe("condition evaluation", () => {
  it("treats a missing condition as passing", () => {
    expect(evaluateCondition(null, values(), variables)).toBe(true);
  });

  it("evaluates nested and, or, and not", () => {
    const turned = project && graphsCondition();
    expect(evaluateCondition(turned, values(), variables)).toBe(true);
    expect(evaluateCondition(turned, values({ var_convinced: true }), variables)).toBe(false);
    expect(evaluateCondition(turned, values({ var_gold: 4 }), variables)).toBe(false);
    expect(evaluateCondition(turned, values({ var_asked_road: true }), variables)).toBe(false);

    const inside: Condition = {
      type: "group",
      op: "or",
      children: [
        { type: "compare", variableId: "var_convinced", op: "eq", value: true },
        { type: "compare", variableId: "var_gold", op: "lt", value: 5 },
      ],
    };
    expect(evaluateCondition(inside, values(), variables)).toBe(false);
    expect(evaluateCondition(inside, values({ var_convinced: true }), variables)).toBe(true);
    expect(evaluateCondition(inside, values({ var_gold: 4 }), variables)).toBe(true);
  });

  it("compares numbers, booleans, and tags", () => {
    expect(
      evaluateCondition(
        { type: "compare", variableId: "var_gold", op: "gte", value: 5 },
        values(),
        variables,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: "compare", variableId: "var_gold", op: "gt", value: true },
        values(),
        variables,
      ),
    ).toBe(false);
    expect(
      evaluateCondition(
        { type: "compare", variableId: "var_location", op: "eq", value: "tag_loc_road" },
        values({ var_location: "tag_loc_road" }),
        variables,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: "compare", variableId: "var_has_token", op: "eq", value: true },
        values(),
        variables,
      ),
    ).toBe(false);
  });

  it("treats an empty and as true and an empty or as false", () => {
    expect(evaluateCondition({ type: "group", op: "and", children: [] }, values(), variables)).toBe(true);
    expect(evaluateCondition({ type: "group", op: "or", children: [] }, values(), variables)).toBe(false);
  });

  it("describes a compound condition in words", () => {
    const text = describeCondition(graphsCondition(), project);
    expect(text).toContain("all of");
    expect(text).toContain("not (convinced is true)");
    expect(text).toContain("gold ≥ 5");
  });
});

describe("effects", () => {
  it("sets booleans, adds to values, and assigns tags", () => {
    const start = values();
    const effects: Effect[] = [
      { id: "a", variableId: "var_convinced", op: "set", value: true },
      { id: "b", variableId: "var_gold", op: "add", value: -1 },
      { id: "c", variableId: "var_location", op: "set", value: "tag_loc_inside" },
    ];
    const next = applyEffects(start, effects, variables);
    expect(next.var_convinced).toBe(true);
    expect(next.var_gold).toBe(4);
    expect(next.var_location).toBe("tag_loc_inside");
  });

  it("toggles booleans and clears tags", () => {
    const toggled = applyEffect(values({ var_has_token: false }), {
      id: "t",
      variableId: "var_has_token",
      op: "toggle",
      value: null,
    }, variables);
    expect(toggled.var_has_token).toBe(true);
    const cleared = applyEffect(toggled, {
      id: "c",
      variableId: "var_location",
      op: "clear",
      value: null,
    }, variables);
    expect(cleared.var_location).toBeNull();
  });
});

function graphsCondition(): Condition {
  return {
    type: "group",
    op: "and",
    children: [
      { type: "not", child: { type: "compare", variableId: "var_convinced", op: "eq", value: true } },
      { type: "compare", variableId: "var_gold", op: "gte", value: 5 },
      { type: "not", child: { type: "compare", variableId: "var_asked_road", op: "eq", value: true } },
    ],
  };
}
