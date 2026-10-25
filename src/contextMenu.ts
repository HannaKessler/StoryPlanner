const TEXT_INPUT_TYPES = new Set(["", "text", "search", "email", "url", "tel", "password", "number"]);

type MaybeEditable = {
  tagName?: string;
  type?: string;
  readOnly?: boolean;
  disabled?: boolean;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
};

export function keepsNativeContextMenu(target: EventTarget | null): boolean {
  const element = target as MaybeEditable | null;
  if (!element || typeof element.tagName !== "string") return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName.toLowerCase();
  if (tag === "textarea") return !element.disabled;
  if (tag === "input") return !element.disabled && TEXT_INPUT_TYPES.has((element.type ?? "").toLowerCase());
  return false;
}

export function suppressBrowserContextMenu(root: Pick<Document, "addEventListener">): void {
  root.addEventListener("contextmenu", (event) => {
    if (!keepsNativeContextMenu(event.target)) event.preventDefault();
  });
}
