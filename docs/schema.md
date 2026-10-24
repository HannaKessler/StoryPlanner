# StoryPlanner project schema

Version **1**. Every project file, graph file, and bundled export carries `schemaVersion`. This app reads version 1 only. A higher number means the file was written by a newer StoryPlanner; do not guess at fields you do not know.

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

There is no depth limit. A node points at an inner graph with `subgraphId`. That graph points back with `parentGraphId` and `parentNodeId`.

## Project document

```json
{
  "schemaVersion": 1,
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
| schemaVersion | number | `1` |
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
  "description": "People who speak.",
  "tags": [
    { "id": "tag_traveler", "name": "Traveler", "description": "", "color": "#e3a15a" }
  ]
}
```

`isCharacters` marks a category whose tags may be chosen as dialogue speakers. A project may mark more than one category. Tags are not global ids across categories; a speaker stores the tag id.

`color` is a display hint (`#rrggbb`).

## Graph document

```json
{
  "schemaVersion": 1,
  "id": "graph_approach",
  "name": "At the gate",
  "parentGraphId": "graph_root",
  "parentNodeId": "node_root_approach",
  "sceneNotes": "The conversation at the shut gate.",
  "nodes": [],
  "edges": []
}
```

The root graph uses `null` for both parent fields. `sceneNotes` on a graph cover that whole graph. Notes on a node cover that beat.

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
  "lines": [],
  "choices": [],
  "effects": []
}
```

`type` is one of `start`, `event`, `scene`, `dialogue`, `end`.

| Type | Role |
| --- | --- |
| start | Entry of this graph. Play begins here. One per graph is the normal case |
| event | A high-level beat. Often owns a subgraph |
| scene | A place and time, with scene notes. May own a subgraph |
| dialogue | Ordered spoken lines and player choices |
| end | Stops this branch |

`position` is the editor canvas point in pixels. Add-ons can ignore it.

`subgraphId` is another graph id, or `null`. Opening that graph is how a writer drills in. Any node may own one. Nesting is unlimited.

`effects` run when play enters the node.

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

### Choice

```json
{
  "id": "choice_coin",
  "label": "Offer a coin",
  "condition": { "type": "compare", "variableId": "var_gold", "op": "gte", "value": 1 },
  "effects": [
    { "id": "fx_coin_gold", "variableId": "var_gold", "op": "add", "value": -1 }
  ]
}
```

A choice is available when its condition passes (and, if the connection has one, that condition passes too). `effects` run when the player takes the choice, before the story moves on.

The connection for a choice is an edge with `choiceId` set to this id and `source` set to the dialogue node. A choice with no such edge still stores its label, condition, and effects.

### Edge

```json
{
  "id": "edge_root_inside",
  "source": "node_root_approach",
  "target": "node_root_inside",
  "choiceId": null,
  "label": "Enter the walls",
  "condition": null
}
```

`choiceId` is `null` for an ordinary connection. Edges are directed. Conditions on an edge gate that connection.

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
  "schemaVersion": 1,
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

- **Screenplay** walks from each graph’s start, writes scene notes as block quotes, and spells conditions and effects in words. The first visit to a beat is written in full. Later visits say `→ Continues at **Title**.`
- **Voice sheets** list, per character category (`isCharacters`), only that character’s lines. Each line is preceded by the italic line or lines it directly answers. The previous line in the same node is the single answer. The first line of a node answers the last spoken line of each way in, and a line inside a nested graph can answer the last line before that graph was entered. Scene notes are included above the line.

## Adding a variable kind later

1. Keep storing `kind` as a string and `defaultValue` as a scalar.
2. Teach the editor and the evaluator the new kind.
3. Leave `schemaVersion` at 1 if no existing field changes meaning. Bump it when a consumer would misread old files.
