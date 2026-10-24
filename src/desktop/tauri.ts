import type { ProjectFs } from "../domain/project";

interface TauriWindow {
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
}

export function inTauri(): boolean {
  if (typeof window === "undefined") return false;
  const host = window as Window & TauriWindow;
  return Boolean(host.__TAURI_INTERNALS__ || host.__TAURI__);
}

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: call } = await import("@tauri-apps/api/core");
  return call<T>(command, args);
}

export function createTauriFs(): ProjectFs {
  return {
    readText: (path) => invoke<string>("read_text_file", { path }),
    writeText: (path, contents) => invoke<void>("write_text_file", { path, contents }),
    list: (path) => invoke<string[]>("list_dir", { path }),
    mkdir: (path) => invoke<void>("create_dir", { path }),
    exists: (path) => invoke<boolean>("path_exists", { path }),
    remove: (path) => invoke<void>("remove_file", { path }),
  };
}

export async function pickDirectory(title: string): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({ directory: true, multiple: false, title });
  if (Array.isArray(result)) return result[0] ?? null;
  return result;
}

export async function pickSaveFile(title: string, defaultPath: string, extension: string): Promise<string | null> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  return save({
    title,
    defaultPath,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
  });
}

export async function sampleProjectDir(): Promise<string> {
  return invoke<string>("sample_project_dir");
}

export async function setWindowTitle(title: string): Promise<void> {
  if (!inTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setTitle(title);
}

export function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong.";
}
