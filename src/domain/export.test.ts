import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { exportScreenplay } from "./screenplay";
import { buildSample } from "./sample";
import { parseGraph, parseJson, parseProject } from "./schema";
import { exportVoiceSheets, responseCues } from "./voices";

const { project, graphs } = buildSample();

describe("screenplay and voice exports", () => {
  it("includes scene notes, dialogue, and transition logic", () => {
    const text = exportScreenplay(project, graphs);
    expect(text).toContain("# The Lantern Gate");
    expect(text).toContain("Two iron lanterns burn beside the gate.");
    expect(text).toContain("**GATEKEEPER**");
    expect(text).toContain("The gate is shut. What business have you past nightfall?");
    expect(text).toContain("**Transitions from At the gate**");
    expect(text).toContain("**Show the lantern token → The token**");
    expect(text).toContain("hasToken is true");
    expect(text).toContain("subtract 1 from gold");
    expect(text).toContain("Mind the step. The stones are slick.");
    expect(text).toContain("The rain sounds different in here.");
  });

  it("lists every line a merged cue responds to, in italics", () => {
    const approach = graphs.graph_approach;
    const crossing = approach.nodes.find((node) => node.id === "node_ap_cross");
    expect(crossing).toBeTruthy();
    const cues = responseCues(approach, crossing!, 0, graphs, project);
    const texts = cues.map((cue) => cue.line.text);
    expect(texts).toContain("Then I will not waste the night.");
    expect(texts).toContain("Spend it on a dry watch, then.");

    const sheets = exportVoiceSheets(project, graphs);
    expect(sheets).toContain("## Gatekeeper");
    expect(sheets).toContain("## Traveler");
    expect(sheets).not.toContain("## Lantern Token");
    const mind = sheets.split("### Mind the step. The stones are slick.")[1]?.split("### ")[0] ?? "";
    expect(mind).toContain("*Then I will not waste the night.*");
    expect(mind).toContain("*Spend it on a dry watch, then.*");
    expect(mind).toContain("The gate begins to open onto wet stone.");

    const token = approach.nodes.find((node) => node.id === "node_ap_token");
    const tokenCues = responseCues(approach, token!, 0, graphs, project);
    expect(tokenCues.map((cue) => [cue.line.id, cue.viaLabel])).toEqual([["line_gate_2", "Show the lantern token"]]);
    expect(sheets).toContain("*(then “Show the lantern token”)*");

    const walked = sheets.split("### I have walked since the east village.")[1]?.split("### ")[0] ?? "";
    expect(walked).toContain("*The gate is shut. What business have you past nightfall?*");
  });
});

describe("sample project folder", () => {
  it("matches the builder", () => {
    const onDisk = parseProject(parseJson(readFileSync("sample-project/project.json", "utf8"), "project.json"));
    expect(onDisk).toEqual(project);
    for (const graph of Object.values(graphs)) {
      const loaded = parseGraph(
        parseJson(readFileSync(`sample-project/graphs/${graph.id}.json`, "utf8"), graph.id),
      );
      expect(loaded).toEqual(graph);
    }
  });
});
