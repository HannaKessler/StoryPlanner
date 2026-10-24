import { describe, expect, it } from "vitest";
import { buildSample } from "./sample";
import { SchemaError, parseBundle, parseGraph, parseProject } from "./schema";
import { bundleProject } from "./project";

describe("schema", () => {
  it("parses the sample project, including an unknown-friendly kind field", () => {
    const { project, graphs } = buildSample();
    const parsed = parseProject(structuredClone(project));
    expect(parsed).toEqual(project);
    expect(parseGraph(graphs.graph_approach)).toEqual(graphs.graph_approach);
  });

  it("rejects a newer schema version", () => {
    const { project } = buildSample();
    expect(() => parseProject({ ...project, schemaVersion: 2 })).toThrow(SchemaError);
    expect(() => parseProject({ ...project, schemaVersion: 2 })).toThrow(/schemaVersion 2/);
  });

  it("preserves an unknown variable kind", () => {
    const { project } = buildSample();
    const withKind = structuredClone(project);
    withKind.variables.push({
      id: "var_future",
      name: "reputation",
      kind: "meter",
      description: "Added by a future version.",
      defaultValue: "steady",
      tagCategoryId: null,
    });
    expect(parseProject(withKind).variables.at(-1)?.kind).toBe("meter");
  });

  it("rejects a boolean variable with a numeric default", () => {
    const { project } = buildSample();
    const broken = structuredClone(project);
    broken.variables[0].defaultValue = 1;
    expect(() => parseProject(broken)).toThrow(/boolean/);
  });

  it("parses a bundle and checks its kind", () => {
    const { project, graphs } = buildSample();
    const bundle = bundleProject(project, graphs, "2026-02-01T00:00:00.000Z");
    expect(parseBundle(bundle)).toEqual(bundle);
    expect(() => parseBundle({ ...bundle, kind: "other" })).toThrow(/storyplanner.bundle/);
  });
});
