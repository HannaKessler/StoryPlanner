# StoryPlanner

StoryPlanner is a local desktop app for planning branching game stories. It tracks story logic, not scripts or engine code. Writers start with high-level events, open any beat into its own graph, and keep drilling until a node holds the actual dialogue. Engine add-ons, built later, read the exported data described in [docs/schema.md](docs/schema.md).

A project is a folder on disk:

```
MyStory/
  project.json          variables and tag categories
  graphs/
    <graphId>.json      one file per graph, including nested graphs
```

`project.json` and every graph file include `"schemaVersion": 3`. Version 1 and 2 projects are migrated when opened.

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

The story model works like a state machine, similar to Unity’s Animator. Beats (events, scenes, dialogue) are states that hold content. Branching happens only on the transitions between them. Each transition has its own conditions and variable changes.

- **New / Open / Save** a project folder, from the start screen or the File menu. Recent projects are remembered in this window.
- **Graph.** The top level is a graph of events. Any event, scene, or dialogue beat can open an inner graph, which works like a sub-state machine. Breadcrumbs show the path and jump back up. There is no fixed depth. **Locations** puts each location tag, plus Unassigned, in a box on its own canvas. Dragging a box moves the beats inside it. Transitions stay drawn, including ones that cross boxes. Those positions are saved apart from the normal graph.
- **Start** is an ordinary beat. A graph can have several, and each can be deleted. Play asks which one to begin from when there is more than one, and warns when there are none.
- **Transitions.** Drag from a beat’s right handle to another beat, or use **+ to…** in the inspector. Each transition has a label, a condition built from All / Any / Not groups, and effects (set, add, toggle, clear). The canvas labels show the condition and effects in words.
- **Left panel.** Beats in this graph, plus a compact list of project-wide variables (boolean, number, tag: name, kind, default value) and tag categories. Everything is edited inline. Click a variable’s kind badge for its description and tag category. Mark a category as **speakers** to use its tags as dialogue speakers.
- **Inspector.** Collapsible sections for the selected beat (notes, dialogue lines with a speaker and direction, transitions out and in) or the selected transition (from, to, order, conditions, effects).
- **Play.** Step through the story from a chosen start. The current beat’s outgoing transitions are the ways forward. Closed ones stay visible, marked blocked, with their condition. The live variables panel shows changed values and can be edited to open another branch.
- **Export.** Bundled JSON for add-ons, a Markdown screenplay (scene notes included, transitions written out), and per-character voice sheets. On a voice sheet, the line a cue answers is in italics, and a line that answers different lines on different paths lists each of them.

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
