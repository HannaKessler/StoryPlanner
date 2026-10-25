import { describe, expect, it } from "vitest";
import { keepsNativeContextMenu, suppressBrowserContextMenu } from "./contextMenu";

const el = (props: Record<string, unknown>) => props as unknown as EventTarget;

describe("keepsNativeContextMenu", () => {
  it("keeps the native menu in text fields", () => {
    expect(keepsNativeContextMenu(el({ tagName: "TEXTAREA" }))).toBe(true);
    expect(keepsNativeContextMenu(el({ tagName: "INPUT", type: "text" }))).toBe(true);
    expect(keepsNativeContextMenu(el({ tagName: "INPUT", type: "number" }))).toBe(true);
    expect(keepsNativeContextMenu(el({ tagName: "DIV", isContentEditable: true }))).toBe(true);
  });

  it("suppresses it everywhere else", () => {
    expect(keepsNativeContextMenu(null)).toBe(false);
    expect(keepsNativeContextMenu(el({ tagName: "DIV" }))).toBe(false);
    expect(keepsNativeContextMenu(el({ tagName: "BUTTON" }))).toBe(false);
    expect(keepsNativeContextMenu(el({ tagName: "SELECT" }))).toBe(false);
    expect(keepsNativeContextMenu(el({ tagName: "INPUT", type: "checkbox" }))).toBe(false);
    expect(keepsNativeContextMenu(el({ tagName: "INPUT", type: "text", disabled: true }))).toBe(false);
  });
});

describe("suppressBrowserContextMenu", () => {
  it("prevents the default only outside text fields", () => {
    let handler: ((event: Event) => void) | undefined;
    suppressBrowserContextMenu({ addEventListener: (_type: string, listener: unknown) => (handler = listener as (event: Event) => void) } as Pick<Document, "addEventListener">);
    const fire = (target: EventTarget) => {
      let prevented = false;
      handler?.({ target, preventDefault: () => (prevented = true) } as unknown as Event);
      return prevented;
    };
    expect(fire(el({ tagName: "DIV" }))).toBe(true);
    expect(fire(el({ tagName: "TEXTAREA" }))).toBe(false);
  });
});
