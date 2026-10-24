import { describeCondition } from "./conditions";
import { describeEffect } from "./effects";
import { speakerName } from "./format";
import { findEntryNode } from "./graphOps";
import type { GraphDocument, ProjectDocument, StoryEdge, StoryNode } from "./types";

const TYPE_LABEL: Record<StoryNode["type"], string> = {
  start: "Start",
  event: "Event",
  scene: "Scene",
  dialogue: "Dialogue",
  end: "End",
};

/**
 * Markdown screenplay. Branching is written in full the first time a beat
 * appears; later visits point back at that heading.
 */
export function exportScreenplay(
  project: ProjectDocument,
  graphs: Record<string, GraphDocument>,
): string {
  const lines: string[] = [
    `# ${project.name || "Untitled story"}`,
    "",
    "Branching screenplay. Each beat is written in full the first time it appears. Later visits point back to it with an arrow. Scene notes are block quotes. Choices and conditional exits show the logic in words, not code.",
    "",
  ];
  const seen = new Set<string>();
  const root = graphs[project.rootGraphId];
  if (!root) {
    lines.push("_This project has no root graph._", "");
  } else {
    writeGraph(root, 2, lines, seen, project, graphs);
  }
  return `${lines.join("\n").trim()}\n`;
}

function writeGraph(
  graph: GraphDocument,
  level: number,
  lines: string[],
  seen: Set<string>,
  project: ProjectDocument,
  graphs: Record<string, GraphDocument>,
) {
  if (graph.sceneNotes.trim()) {
    lines.push(...quote(graph.sceneNotes), "");
  }
  const entry = findEntryNode(graph);
  if (entry) writeNode(graph, entry, level, lines, seen, project, graphs);
  for (const node of graph.nodes) {
    if (!seen.has(key(graph, node))) {
      lines.push("_Not reachable from the start of this graph._", "");
      writeNode(graph, node, level, lines, seen, project, graphs);
    }
  }
}

function writeNode(
  graph: GraphDocument,
  node: StoryNode,
  level: number,
  lines: string[],
  seen: Set<string>,
  project: ProjectDocument,
  graphs: Record<string, GraphDocument>,
) {
  const id = key(graph, node);
  if (seen.has(id)) {
    lines.push(`→ Continues at **${node.title || "Untitled"}**.`, "");
    return;
  }
  seen.add(id);
  if (node.type === "start") {
    writeExits(graph, node, level, lines, seen, project, graphs);
    return;
  }
  lines.push(heading(level, node.title || "Untitled"), "");
  lines.push(`*${TYPE_LABEL[node.type]}*`, "");
  if (node.summary.trim()) {
    lines.push(node.summary.trim(), "");
  }
  if (node.sceneNotes.trim()) {
    lines.push(...quote(node.sceneNotes), "");
  }
  for (const line of node.lines) {
    const speaker = speakerName(project, line.speakerTagId).toUpperCase();
    lines.push(`**${speaker}**`);
    if (line.direction.trim()) lines.push(`*(${line.direction.trim()})*`);
    lines.push("", line.text.trim() || "…", "");
  }
  for (const effect of node.effects) {
    lines.push(`*On enter: ${describeEffect(effect, project)}.*`);
  }
  if (node.effects.length) lines.push("");

  if (node.subgraphId && graphs[node.subgraphId]) {
    const child = graphs[node.subgraphId];
    lines.push(`*Inner graph: ${child.name || "Untitled"}*`, "");
    writeGraph(child, Math.min(level + 1, 6), lines, seen, project, graphs);
  }

  writeExits(graph, node, level, lines, seen, project, graphs);
}

function writeExits(
  graph: GraphDocument,
  node: StoryNode,
  level: number,
  lines: string[],
  seen: Set<string>,
  project: ProjectDocument,
  graphs: Record<string, GraphDocument>,
) {
  const choiceEdges = new Map<string, StoryEdge>();
  const plain: StoryEdge[] = [];
  for (const edge of graph.edges) {
    if (edge.source !== node.id) continue;
    if (edge.choiceId) choiceEdges.set(edge.choiceId, edge);
    else plain.push(edge);
  }

  if (node.choices.length || (plain.length > 0 && node.type !== "start")) {
    lines.push("**Branches**", "");
  }
  for (const choice of node.choices) {
    lines.push(`**Choice — ${choice.label || "Untitled choice"}**`);
    lines.push(`*When ${describeCondition(choice.condition, project)}.*`);
    if (choice.effects.length) {
      lines.push(`*Then ${choice.effects.map((effect) => describeEffect(effect, project)).join(". ")}.*`);
    }
    lines.push("");
    const edge = choiceEdges.get(choice.id);
    if (!edge) {
      lines.push("_This choice is not connected._", "");
      continue;
    }
    if (edge.condition) lines.push(`*Connection: ${describeCondition(edge.condition, project)}.*`, "");
    const target = graph.nodes.find((item) => item.id === edge.target);
    if (target) writeNode(graph, target, level, lines, seen, project, graphs);
  }
  for (const edge of plain) {
    const target = graph.nodes.find((item) => item.id === edge.target);
    if (node.type !== "start") {
      const label = edge.label || target?.title || "Continue";
      lines.push(`**Exit — ${label}**`);
      lines.push(`*When ${describeCondition(edge.condition, project)}.*`, "");
    }
    if (target) writeNode(graph, target, level, lines, seen, project, graphs);
  }
}

function key(graph: GraphDocument, node: StoryNode): string {
  return `${graph.id}:${node.id}`;
}

function heading(level: number, text: string): string {
  return `${"#".repeat(Math.min(6, Math.max(1, level)))} ${text}`;
}

function quote(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => `> ${line}`);
}
