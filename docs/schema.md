# StoryPlanner project schema

Version **4**. Every project file, graph file, and bundled export carries `schemaVersion`. This app writes version 4 and still reads versions 1, 2, and 3 (see [Older files](#older-files)). A higher number means the file was written by a newer StoryPlanner; do not guess at fields you do not know.

The story model works like a state machine. **Every node is the same kind of beat.** A beat can hold a title, notes, one location, characters, items, dialogue, effects, and a sub-graph. **Edges are gates.** A transition is available when its condition passes, and it changes nothing by itself. Effects live on the beat and run when play enters it.

Locations, characters, and items are project data, not graph nodes. Each has notes and image paths. A beat stores only its own references. What a beat *involves* — its own references plus everything in its sub-graph — is computed, not stored on the beat.

Engine add-ons should treat this document as the contract. Files are UTF-8 JSON. Unknown object keys are dropped when StoryPlanner saves, so do not store private data beside the documented fields. Unknown **variable kinds** are the exception: the `kind` string is open-ended and is preserved.

Ids are opaque non-empty strings. StoryPlanner generates UUIDs. The sample project uses readable ids. Do not parse meaning out of an id.

## Folder layout

```
MyStory/
  project.json
  graphs/
    <graphId>.json
  assets/
    <entityId>/
      image.png
```

`project.json` is the project document. Each graph, including the root and every nested graph, is one file under `graphs/`. The file name is `<id>.json`, matching `GraphDocument.id`.

Images copied into the project live under `assets/`. Entity `images` stores paths relative to the project folder.

There is no depth limit. A node points at a sub-graph with `subgraphId`. That graph points back with `parentGraphId` and `parentNodeId`.

## Project document

```json
{
  "schemaVersion": 4,
  "id": "proj_lantern_gate",
  "name": "The Lantern Gate",
  "createdAt": "2026-01-15T18:00:00.000Z",
  "updatedAt": "2026-01-15T18:00:00.000Z",
  "rootGraphId": "graph_root",
  "variables": [],
  "characters": [],
  "items": [],
  "locations": []
}
```

| Field | Type | Notes |
| --- | --- | --- |
| schemaVersion | number | `4` |
| id | string | Stable project id |
| name | string | Display name |
| createdAt, updatedAt | string | ISO-8601 timestamps |
| rootGraphId | string | Id of the top-level graph |
| variables | Variable[] | Project-wide. No scoping |
| characters, items, locations | Entity[] | People, things, and places. Not nodes |

### Entity

```json
{
  "id": "tag_traveler",
  "name": "Traveler",
  "notes": "The player character.",
  "images": ["assets/tag_traveler/portrait.png"],
  "fields": [{ "key": "color", "value": "#e3a15a" }]
}
```

| Field | Type | Notes |
| --- | --- | --- |
| id | string | Stable id. Dialogue speakers and beat references store this |
| name | string | Display name. May be empty |
| notes | string | Free-form notes |
| images | string[] | Paths relative to the project folder |
| fields | { key, value }[] | Optional extra text. Both strings. Empty until some are added |

`fields` is open-ended. This version does not assign meaning to particular keys. A migrated tag color is kept as `{ "key": "color", "value": "#rrggbb" }`.

### Variable

```json
{
  "id": "var_gold",
  "name": "gold",
  "kind": "value",
  "description": "Coins in the traveler's purse.",
  "defaultValue": 5
}
```

`kind` is a string so more kinds can be added later without reshaping the file. This version creates:

| Kind | defaultValue | Meaning |
| --- | --- | --- |
| `boolean` | `true` or `false` | A flag |
| `value` | finite number | A number |
| `character` | character id or `null` | One character |
| `item` | item id or `null` | One item |
| `location` | location id or `null` | One location |
| `inventory` | string[] of item ids | A set of items. Empty is `[]` |

Add-ons should keep unknown kinds and their `defaultValue` (`boolean`, `number`, `string`, `null`, or an array of strings). This editor will not rewrite them into a known kind. Equality (`eq` / `neq`) still works on scalars. Other comparisons and arithmetic do not.

## Graph document

```json
{
  "schemaVersion": 4,
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

`locationBoxes` is the location view for this graph. Each entry is one box:

| id | Box |
| --- | --- |
| a location id | Beats placed in that location |
| `"unplaced"` | Beats with no location of their own and no single inherited location |
| `"multiple"` | Beats with no location of their own and more than one inherited location |

`position` is the box’s point on that canvas. `size` is `{ "width", "height" }`. An empty array, or a missing field, means no box has been moved or resized yet. Boxes the user has not touched are left out of the array. The editor still draws an Unplaced box, and a Multiple box only when some beat needs it.

### Node

```json
{
  "id": "node_ap_gate",
  "type": "beat",
  "position": { "x": 300, "y": 220 },
  "title": "At the gate",
  "summary": "",
  "sceneNotes": "The gatekeeper does not open the shutter at first.",
  "subgraphId": null,
  "locationId": "tag_loc_gate",
  "characterIds": ["tag_gatekeeper"],
  "itemIds": [],
  "locationPosition": null,
  "lines": [],
  "effects": []
}
```

`type` is always `"beat"`. Older files used `start`, `event`, `scene`, `dialogue`, and `end`. Those become beats on load. Connections are kept.

| Field | Type | Notes |
| --- | --- | --- |
| title, summary, sceneNotes | string | Optional. Empty until set. A generated label is not stored |
| position | point | Graph-view point in pixels. The location view does not write it |
| subgraphId | string or null | Another graph, or null |
| locationId | string or null | This beat’s own place. One location |
| characterIds | string[] | Characters on this beat. Speakers are not copied into this list |
| itemIds | string[] | Items on this beat |
| locationPosition | point or null | Point inside the location box. Null until the location view places it |
| lines | DialogueLine[] | Spoken lines, in order |
| effects | Effect[] | Applied when play enters this beat |

A beat does not store what it inherits from a sub-graph. See [Involved](#involved).

The location view groups a beat by `locationId`. If that is null and the beat inherits exactly one location, it uses that location. Otherwise it goes in Multiple or Unplaced.

### Dialogue line

```json
{
  "id": "line_gate_1",
  "speakerId": "tag_gatekeeper",
  "text": "The gate is shut. What business have you past nightfall?",
  "direction": "He does not lift the lantern."
}
```

`speakerId` is a character id, or `null` for narration. `direction` is a short parenthetical. Longer setting lives in `sceneNotes`.

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
  }
}
```

| Field | Type | Notes |
| --- | --- | --- |
| source, target | string | Node ids in the same graph |
| label | string | What the transition is called. May be empty |
| condition | Condition or null | Available when this passes. `null` means always |

A transition has no effects. Taking it enters the target, and the target’s effects run then. The outgoing transitions of a node keep their order in `edges`.

### Moving through a graph

- Play waits for a beat to be chosen. Any beat in the graph can be chosen. Beats with no incoming edge are the sensible defaults, not a restriction.
- Entering a beat runs that beat’s `effects`, in order.
- From the current beat, every outgoing edge whose condition passes can be followed. Following it enters `target` and runs the target’s effects. The edge itself changes nothing.
- If the current beat has a `subgraphId`, play can step into that graph and again choose any beat there. Returning to the parent runs no effects.
- A run ends when the current beat has no outgoing transition and there is no way back up. A transition that is blocked stays available so a variable change can open it.

## Involved

Involvement is derived. It is not a field of the stored node.

A beat’s **own** references are:

- `locationId`, when set
- `characterIds`
- `itemIds`
- every dialogue `speakerId`

A beat’s **involved** set is that union, plus the involved set of every beat in `subgraphId`, at every depth. Inheritance only flows upward. A child does not gain its parent’s references. Cycles stop once a pass adds nothing.

The location view uses the inherited locations only when the beat has no `locationId` of its own.

A bundled JSON export may add `involved` onto each node as a convenience:

```json
{ "locationIds": ["tag_loc_gate"], "characterIds": [], "itemIds": [] }
```

That object is the full involved set (own plus inherited). Loading a bundle drops it. The source of truth remains each beat’s own fields.

## Conditions

A condition is `null` (always passes) or one of:

```json
{ "type": "group", "op": "and", "children": [] }
{ "type": "group", "op": "or", "children": [] }
{ "type": "not", "child": { "type": "compare", "variableId": "var_convinced", "op": "eq", "value": true } }
{ "type": "compare", "variableId": "var_gold", "op": "gte", "value": 5 }
{ "type": "has", "variableId": "var_bag", "entityId": "tag_item_token" }
```

Groups nest. `not` wraps one child. Compare ops are `eq`, `neq`, `gt`, `gte`, `lt`, `lte`. `has` checks membership: an inventory contains `entityId`, or a character, item, or location variable equals it.

Evaluation, against the current variable values:

- `null` passes.
- `and` passes when every child passes. An empty `and` passes.
- `or` passes when any child passes. An empty `or` fails.
- `not` inverts its child.
- Numeric ops apply when both sides are numbers.
- Otherwise only `eq` and `neq` apply, using same-value equality. `gt` on a boolean fails.
- A compare or `has` whose variable is missing fails.
- `has` on an array passes when the array contains `entityId`. On a scalar it passes when the current value equals `entityId`.

## Effects

```json
{ "id": "fx_coin_gold", "variableId": "var_gold", "op": "add", "value": -1 }
```

Effects are stored on beats. `value` is a scalar: boolean, number, string, or null. An inventory effect’s `value` is one item id.

| op | Behavior |
| --- | --- |
| set | Assign `value` when it matches the kind. For inventory, a string becomes a one-item list and `null` clears it |
| add | Add a number to a numeric value, or add an item id to an inventory |
| remove | Remove an entity. A single-entity variable becomes `null`. An inventory drops that id |
| toggle | Flip a boolean |
| clear | Boolean becomes false, value becomes 0, an entity reference becomes `null`, an inventory becomes `[]` |

Effects run in array order when the beat is entered. An effect whose variable or value does not fit the kind is skipped.

## Bundle

Export → Bundled JSON writes one document:

```json
{
  "schemaVersion": 4,
  "kind": "storyplanner.bundle",
  "exportedAt": "2026-04-01T00:00:00.000Z",
  "project": {},
  "graphs": []
}
```

`project` is the project document, including entities, notes, and image paths. `graphs` is every graph. Node copies in the bundle may include the computed `involved` object described above. `kind` is the literal `storyplanner.bundle`.

## What is not stored

Play-through state (current beat, live variable values, the path taken) is runtime only. Which entities a parent involves is computed from sub-graphs. Screenplay and voice-actor sheets are derived when exported.

Derived exports in this version are Markdown:

- **Screenplay** walks from each entry beat (a beat nothing points at). If a graph has none, it walks every beat. Scene notes are block quotes. A beat’s effects are written as `*On enter: …*`. Each transition’s condition is spelled out; transitions have no effects. The first visit to a beat is written in full. Later visits say `→ Continues at **Title**.`
- **Voice sheets** list one section per character. Only that character’s lines are included. Each line is preceded by the italic line or lines it directly answers.

## Older files

StoryPlanner reads versions 1, 2, and 3 and writes version 4.

### Version 3

Version 3 used tag categories instead of entities, and effects lived on transitions.

- Categories marked `isCharacters` become characters. Categories marked `isLocations` become locations. A category whose name looks like items, inventory, objects, props, gear, weapons, or keys becomes items. Any other category also becomes items, and the category name is kept in the entity notes and in a `category` field, so nothing is dropped.
- Tag ids are kept, so references stay stable. A tag’s description becomes notes. A color becomes a `color` field.
- A beat’s location tags: the earliest in project order becomes `locationId`. Further location names are appended to `sceneNotes`. Character tags become `characterIds`. Item tags become `itemIds`.
- `speakerTagId` becomes `speakerId`.
- A variable of kind `tag` becomes a character, item, or location variable matching its category. If the variable or the category is named like an inventory, it becomes an inventory and the default is wrapped in a list.
- Each transition’s effects are appended to the target beat’s effects. The same variable, op, and value is not copied twice. Edges are stored without effects.
- A location box id `"unassigned"` is read as `"unplaced"`.

### Version 2

Version 2 is the version 3 shape without `tagIds` on nodes and without `isLocations` on categories. Those beats get no entity references. The rest of the version 3 migration applies, including moving edge effects onto the target beat.

### Version 1

Version 1 kept player choices (`choices`) and on-enter `effects` on nodes, and edges had a `choiceId`. On load, choices and on-enter effects are folded onto edges first (on-enter effect ids are prefixed with the edge id). The version 4 step then moves those edge effects onto the target beat and drops duplicates. A choice with no edge is dropped. The node types become beats.

Add-ons only need to read version 4. Re-save older projects in StoryPlanner first.
