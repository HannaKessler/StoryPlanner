# StoryPlanner

StoryPlanner is a local desktop app for planning branching game stories. It tracks story logic, not scripts or engine code. Writers start with high-level events, open any beat into its own graph, and keep drilling until a node holds the actual dialogue. Engine add-ons, built later, read the exported data described in [docs/schema.md](docs/schema.md).

A project is a folder on disk:

```
MyStory/
  project.json          variables, characters, items, and locations
  graphs/
    <graphId>.json      one file per graph, including nested graphs
  assets/               images copied in for those entities
```

`project.json` and every graph file include `"schemaVersion": 4`. Version 1, 2, and 3 projects are migrated when opened.

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

The story model works like a state machine. There is one beat type. A beat can hold a title, notes, one location, characters, items, dialogue, effects, and a sub-graph. Transitions are gates: they have conditions and change nothing. Effects live on the beat and run when it is entered.

- **New / Open / Save** a project folder, from the start screen or the File menu. Recent projects are remembered in this window.
- **Graph.** Right-click a beat and choose **Create sub-graph** to make one. When it already exists, that menu says **Open**, and double-click opens it too. Breadcrumbs show the path and jump back up. There is no fixed depth. A new beat has no title until one is added. A card shows its title, the locations, characters, and items it involves, its summary, every dialogue line, and its effects — each only when there is something to show. A parent lists what its sub-graph involves. Those inherited names are muted, and only the beat’s own references are editable. **Locations** puts each location in a box. A beat with no place of its own uses its single inherited location; otherwise it sits in Unplaced, or in Multiple when it inherits more than one. Dragging a box moves the beats inside it. Transitions stay drawn, including ones that cross boxes. Those positions are saved apart from the normal graph.
- **Characters, items, and locations** are not nodes. The left panel opens an editor for each: a list, notes, an image gallery, and a few extra fields. Images are copied into the project’s `assets/` folder. Right-click to add or delete. Dialogue speakers are characters. Variables can hold a character, an item, a location, or a set of items.
- **Transitions.** Drag from a beat’s right handle to another beat. Each transition has a label and a condition (All / Any / Not, comparisons, and a contains check). The canvas label shows the condition. Effects are edited on the beat.
- **Left panel.** Beats in this graph, variables, and links to the three libraries.
- **Inspector.** The selected beat’s own location, characters, items, notes, effects, and lines. Inherited entities are listed and cannot be edited there. The selected transition has from, to, order, and conditions.
- **Play.** Pick any beat to begin. Beats with no incoming transition are offered first. Entering a beat applies its effects. Outgoing transitions are the ways forward. Closed ones stay visible, marked blocked. A run ends when no transition can be taken. The live variables panel can be edited to open another branch.
- **Export.** Bundled JSON for add-ons (entities, and a computed `involved` set on each beat), a Markdown screenplay, and per-character voice sheets. The stored file does not keep `involved`; each beat’s own references are the source of truth.

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
