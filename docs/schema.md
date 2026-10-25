# StoryPlanner project schema

Version **3**. Every project file, graph file, and bundled export carries `schemaVersion`. This app writes version 3 and still reads versions 1 and 2 (see [Older files](#older-files)). A higher number means the file was written by a newer StoryPlanner; do not guess at fields you do not know.

The story model works like a state machine (think of Unity’s Animator). **Nodes are states**: events, scenes, and dialogue that hold content. **Edges are transitions**: all branching lives on them. Each transition has its own condition on global variables and its own variable effects. Any node can own a sub-graph, which works like a sub-state machine. Nodes never contain choices.

Engine add-ons should treat this document as the contract. Files are UTF-8 JSON. Unknown object keys are dropped when StoryPlanner saves, so do not store private data beside the documented fields. Unknown **variable kinds** are the exception: the `kind` string is open-ended and is preserved.

Ids are opaque non-empty strings. StoryPlanner generates UUIDs. The sample project uses readable ids. Do not parse meaning out of an id.

## Folder layout

```
MyStory/
  project.json
  graphs/
    <graphId>.json
    <graphId>.json
```

`project.json` is the project document. Each graph, including the root and every nested graph, is one file under `graphs/`. The file name is `<id>.json`, matching `GraphDocument.id`.

There is no depth limit. A node points at a sub-graph with `subgraphId`. That graph points back with `parentGraphId` and `parentNodeId`.

## Project document

```json
{
  "schemaVersion": 3,
  "id": "proj_lantern_gate",
  "name": "The Lantern Gate",
  "createdAt": "2026-01-15T18:00:00.000Z",
  "updatedAt": "2026-01-15T18:00:00.000Z",
  "rootGraphId": "graph_root",
  "variables": [],
  "tagCategories": []
}
```

| Field | Type | Notes |
| --- | --- | --- |
| schemaVersion | number | `3` |
| id | string | Stable project id |
| name | string | Display name |
| createdAt, updatedAt | string | ISO-8601 timestamps |
| rootGraphId | string | Id of the top-level graph |
| variables | Variable[] | Project-wide. No scoping |
| tagCategories | TagCategory[] | User-defined categories |

### Variable

```json
{
  "id": "var_gold",
  "name": "gold",
  "kind": "value",
  "description": "Coins in the traveler's purse.",
  "defaultValue": 5,
  "tagCategoryId": null
}
```

`kind` is a string so more kinds can be added later without reshaping the file. This version creates:

| Kind | defaultValue | Meaning |
| --- | --- | --- |
| `boolean` | `true` or `false` | A flag |
| `value` | finite number | A number. Not an integer type and not a programming-language type |
| `tag` | tag id or `null` | A single tag from `tagCategoryId` |

`tagCategoryId` is the category a tag variable draws from, or `null`.

Add-ons should keep unknown kinds and their scalar `defaultValue` (`boolean`, `number`, `string`, or `null`). This editor will not rewrite them into a known kind. Equality (`eq` / `neq`) still works on them. Other comparisons and arithmetic do not.

There are no enums and no nested types.

### Tag category and tag

```json
{
  "id": "cat_characters",
  "name": "Characters",
  "isCharacters": true,
  "isLocations": false,
  "description": "People who speak.",
  "tags": [
    { "id": "tag_traveler", "name": "Traveler", "description": "", "color": "#e3a15a" }
  ]
}
```

`isCharacters` marks a category whose tags may be chosen as dialogue speakers. `isLocations` marks a category whose tags are places. A project may mark more than one category for either role. Tags are not global ids across categories; a speaker or a beat stores the tag id.

```json
{ "id": "cat_locations", "name": "Locations", "isCharacters": false, "isLocations": true, "description": "", "tags": [] }
```

`color` is a display hint (`#rrggbb`).

## Graph document

```json
{
  "schemaVersion": 3,
  "id": "graph_approach",
  "name": "At the gate",
  "parentGraphId": "graph_root",
  "parentNodeId": "node_root_approach",
  "sceneNotes": "The conversation at the shut gate.",
  "locationBoxes": [],
  "nodes": [],
  "edges": []
}
```

The root graph uses `null` for both parent fields. `sceneNotes` on a graph cover that whole graph. Notes on a node cover that beat.

`locationBoxes` is the location view for this graph. Each entry is one box: `id` is a location tag id, or `"unassigned"` for beats with no location tag. `position` is the box’s point on that canvas. `size` is its width and height. Moving a box moves the beats inside it. An empty array, or a missing field, means no box has been moved or resized yet; the editor then lays the boxes out itself. Boxes the user has not touched are left out of the array.

### Node

```json
{
  "id": "node_ap_gate",
  "type": "dialogue",
  "position": { "x": 300, "y": 220 },
  "title": "At the gate",
  "summary": "",
  "sceneNotes": "The gatekeeper does not open the shutter at first.",
  "subgraphId": null,
  "tagIds": ["tag_loc_gate"],
  "locationPosition": null,
  "lines": []
}
```

`type` is one of `start`, `event`, `scene`, `dialogue`, `end`.

| Type | Role |
| --- | --- |
| start | An entry of this graph. A graph may have several, and may have none. Play begins at one of them |
| event | A high-level beat. Often owns a sub-graph |
| scene | A place and time, with scene notes. May own a sub-graph |
| dialogue | Ordered spoken lines |
| end | Stops this branch |

Start is an ordinary beat. It can be added, deleted, and connected like any other type. A file with no start node, or with several, is valid. The editor warns when the graph currently open has none.

`title` may be empty. The editor does not store a generated name. A consumer that needs a label should treat an empty title as unnamed.

`position` is the editor’s graph-view point in pixels. The location view must not write it. Add-ons can ignore it.

`locationPosition` is that beat’s point inside its location box, in pixels from the box’s top left. `null` means the location view has not placed it yet and will use a default. A missing field is read as `null`.

`tagIds` lists tags on the beat. Location tags are the ones whose category has `isLocations: true`. A beat may carry more than one. The location view draws the beat once, inside the box of the earliest of those tags in project order (category order, then tag order). Tags that are not places stay on the beat and do not make a box.

`subgraphId` is another graph id, or `null`. Opening that graph is how a writer drills in. Any node may own one. Nesting is unlimited.

A node has no logic of its own. What happens next, and which variables change, is decided by the transitions that leave it.

### Dialogue line

```json
{
  "id": "line_gate_1",
  "speakerTagId": "tag_gatekeeper",
  "text": "The gate is shut. What business have you past nightfall?",
  "direction": "He does not lift the lantern."
}
```

`speakerTagId` is a tag id, or `null` for narration. The tag should belong to a category with `isCharacters: true`. `direction` is a short parenthetical for that line. Longer setting and action live in `sceneNotes`.

### Edge (transition)

```json
{
  "id": "edge_ap_coin",
  "source": "node_ap_gate",
  "target": "node_ap_bribe",
  "label": "Offer a coin",
  "condition": {
    "type": "group",
    "op": "and",
    "children": [
      { "type": "compare", "variableId": "var_gold", "op": "gte", "value": 1 },
      { "type": "not", "child": { "type": "compare", "variableId": "var_convinced", "op": "eq", "value": true } }
    ]
  },
  "effects": [
    { "id": "fx_coin_gold", "variableId": "var_gold", "op": "add", "value": -1 }
  ]
}
```

| Field | Type | Notes |
| --- | --- | --- |
| id | string | Stable edge id |
| source, target | string | Node ids in the same graph. Edges are directed |
| label | string | What the transition is called. A player-facing option, an exit name, or empty |
| condition | Condition or null | The transition is available when this passes. `null` means always |
| effects | Effect[] | Run in order when the transition is followed, before the target is entered |

The outgoing transitions of a node keep their order in `edges`. The editor and the exports list them in that order. An engine can use it as priority, or offer every open transition to the player. Several transitions may connect the same two nodes.

A player choice is a labelled transition. The label is the text of the option, the condition decides whether it is open, and the effects record what taking it changes.

### Moving through a graph

- Play starts at a `start` node of the root graph. One start is entered immediately. Several starts wait until one is chosen. No start means play does not begin; that is a warning, not an invalid file.
- From the current node, every outgoing edge whose condition passes can be followed. Following it runs its `effects`, then enters `target`.
- If the current node has a `subgraphId`, play can enter that graph at one of its `start` nodes, choosing when there is more than one. From inside, play can return to the parent node and continue with the parent’s outgoing transitions. Returning runs no effects.
- An `end` node, or a node with no open transition, ends that branch.

## Conditions

A condition is `null` (always passes) or one of:

```json
{ "type": "group", "op": "and", "children": [] }
{ "type": "group", "op": "or", "children": [] }
{ "type": "not", "child": { "type": "compare", "variableId": "var_convinced", "op": "eq", "value": true } }
{ "type": "compare", "variableId": "var_gold", "op": "gte", "value": 5 }
```

Groups nest. `not` wraps one child. Compare ops are `eq`, `neq`, `gt`, `gte`, `lt`, `lte`.

Evaluation, against the current variable values:

- `null` passes.
- `and` passes when every child passes. An empty `and` passes.
- `or` passes when any child passes. An empty `or` fails.
- `not` inverts its child.
- Numeric ops apply when both sides are numbers.
- Otherwise only `eq` and `neq` apply, using same-value equality. `gt` on a boolean fails.
- A compare whose variable is missing fails.

Writers build this in the condition editor. Nothing in the file is an expression language.

## Effects

```json
{ "id": "fx_token_location", "variableId": "var_location", "op": "set", "value": "tag_loc_inside" }
```

| op | Behavior |
| --- | --- |
| set | Assign `value` when it matches the kind (`boolean`, finite `number`, or a string / `null` for tags) |
| add | Add a number to a numeric current value. Negative numbers subtract |
| toggle | Flip a boolean |
| clear | Boolean becomes false, value becomes 0, tag becomes `null` |

Effects run in array order. An effect whose variable or value does not fit the kind is skipped.

## Bundle

Export → Bundled JSON writes one document:

```json
{
  "schemaVersion": 3,
  "kind": "storyplanner.bundle",
  "exportedAt": "2026-04-01T00:00:00.000Z",
  "project": {},
  "graphs": []
}
```

`project` is the project document. `graphs` is every graph document, including nested ones. `kind` is the literal `storyplanner.bundle`.

## What is not stored

Play-through state (current beat, live variable values, the path taken) is runtime only. Screenplay and voice-actor sheets are derived from the graph when exported; they are not a second source of truth.

Derived exports in this version are Markdown:

- **Screenplay** walks from each of a graph’s start nodes, writes scene notes as block quotes, and spells each transition’s condition and effects in words. The first visit to a beat is written in full. Later visits say `→ Continues at **Title**.` A beat that no start reaches is marked not reachable.
- **Voice sheets** list, per character category (`isCharacters`), only that character’s lines. Each line is preceded by the italic line or lines it directly answers. The previous line in the same node is the single answer. The first line of a node answers the last spoken line of each way in, and a line inside a nested graph can answer the last line before that graph was entered. When the transition into the node has a label, the sheet names it after the cue. Scene notes are included above the line.

## Adding a variable kind later

1. Keep storing `kind` as a string and `defaultValue` as a scalar.
2. Teach the editor and the evaluator the new kind.
3. Leave `schemaVersion` as it is if no existing field changes meaning. Bump it when a consumer would misread old files.

## Older files

### Version 2

Version 2 is the state-machine file described above, without `tagIds` on nodes and without `isLocations` on categories. StoryPlanner fills those in on load and writes version 3 on the next save:

- A node with no `tagIds` gets `[]`.
- A node with no `locationPosition` gets `null`.
- A graph with no `locationBoxes` gets `[]`.
- A category with no `isLocations` gets `false`.

Start nodes already in the file stay as they are. Several starts are allowed; nothing in the file is rewritten to enforce a single start.

### Version 1

Version 1 kept player choices (`choices`) and on-enter `effects` on nodes, and edges had a `choiceId`. Version 2 moved all of that onto edges. StoryPlanner migrates a version 1 graph when it loads it, applies the version 2 defaults above, and writes version 3 on the next save:

- An edge whose `choiceId` names a choice on its source node takes the choice’s label (unless the edge had its own), the choice’s condition joined with the edge’s condition by `and`, and the choice’s effects.
- A node’s on-enter effects are appended to every incoming edge in the same graph. Their ids are prefixed with the edge id so they stay unique.
- A choice with no edge, and on-enter effects of a node with no incoming edge, have nowhere to go and are dropped.

Add-ons only need to read version 3. Re-save older projects in StoryPlanner first.
