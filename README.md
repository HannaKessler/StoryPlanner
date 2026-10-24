# StoryPlanner

StoryPlanner is a local desktop app for planning branching game stories. It tracks story logic, not scripts or engine code. Writers start with high-level events, open any beat into its own graph, and keep drilling until a node holds the actual dialogue. Engine add-ons, built later, read the exported data described in [docs/schema.md](docs/schema.md).

A project is a folder on disk:

```
MyStory/
  project.json          variables and tag categories
  graphs/
    <graphId>.json      one file per graph, including nested graphs
```

`project.json` and every graph file include `"schemaVersion": 1`.

## Run it

Prerequisites:

- Node.js 20 or newer
- Rust stable (1.90 or newer; Tauri 2.12 needs it)
- A WebView for Tauri:
  - **Linux:** `libwebkit2gtk-4.1-dev`, GTK 3, and the usual build tools. On Debian or Ubuntu:

    ```bash
    sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev
    ```

  - **macOS:** Xcode command line tools
  - **Windows:** WebView2 and the Visual Studio C++ build tools

Then:

```bash
npm install
npm run tauri dev
```

The first launch compiles the Rust shell and can take a few minutes. The window talks to the Vite dev server on port 1420.

Checks that do not need a window:

```bash
npm test
npm run build
```

## What you can do

- **New / Open / Save** a project folder, from the start screen or the File menu. Recent projects are remembered in this window.
- **Graph.** The top level is a graph of events. Double-purpose beats (events, scenes, dialogue) can open an inner graph. Breadcrumbs show the path and jump back up. There is no fixed depth.
- **Variables.** Project-wide booleans, numbers (`value`), and tags. The kind list in the file is open-ended so more can be added later.
- **Tags.** Your own categories. Mark a category as characters and its tags can speak. New tags can be added from the line editor or from a condition.
- **Dialogue.** Ordered lines, a speaker, and a line note. Scene notes sit on the beat.
- **Choices and connections.** Each can require a condition built from All / Any / Not groups, and can set variables (set, add, toggle, clear).
- **Play.** Step through the story. Choices and exits that fail their conditions stay visible but disabled. The variables panel is live, so you can flip a flag and see the branch open.
- **Export.** Bundled JSON for add-ons, a Markdown screenplay (scene notes included, branches written out), and per-character voice sheets. On a voice sheet, the line a cue answers is in italics, and a line that answers different lines on different paths lists each of them.

The included sample is [sample-project](sample-project): *The Lantern Gate*. **Open sample** on the start screen loads that folder. Saving it writes back into `sample-project/`.

## Repo layout

```
src/                 React UI
src/domain           schema, conditions, save/load, play, exports
src-tauri            Tauri shell and native file commands
docs/schema.md       file format for engine add-ons
sample-project/      small project you can open
```

`npm run write-sample` regenerates `sample-project/` from `src/domain/sample.ts` if those drift.
