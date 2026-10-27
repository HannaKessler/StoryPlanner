import { describe, expect, it } from "vitest";
import { createEntity } from "./factories";
import { entityLabel, isDuplicateName, newEntityName, uniqueName } from "./names";
import { createNewProject } from "./project";

describe("names", () => {
  it("detects duplicates ignoring case and spaces", () => {
    expect(isDuplicateName(" Gold ", ["gold"])).toBe(true);
    expect(isDuplicateName("", [""])).toBe(false);
    expect(isDuplicateName("gold", ["golden"])).toBe(false);
  });

  it("suffixes a taken name", () => {
    expect(uniqueName("Guard", ["Guard"])).toBe("Guard 2");
    expect(uniqueName("Guard", ["Guard", "guard 2"])).toBe("Guard 3");
    expect(uniqueName("Guard 2", ["Guard 2"])).toBe("Guard 3");
    expect(uniqueName("Free", ["Guard"])).toBe("Free");
  });

  it("names new entities by kind and position", () => {
    expect(newEntityName("character", [])).toBe("Character 1");
    expect(newEntityName("item", [createEntity({ name: "Item 2" })])).toBe("Item 3");
  });

  it("labels unnamed entities by position", () => {
    const { project } = createNewProject("T", "2026-01-01T00:00:00.000Z");
    project.characters = [createEntity({ id: "a", name: "Ann" }), createEntity({ id: "b", name: "" })];
    expect(entityLabel(project, project.characters[0])).toBe("Ann");
    expect(entityLabel(project, project.characters[1])).toBe("Character 2");
  });
});
