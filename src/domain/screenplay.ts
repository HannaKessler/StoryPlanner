import { describeCondition } from "./conditions";
import { describeEffect } from "./effects";
import { speakerName } from "./format";
import { entryNodes } from "./graphOps";
import { beatLabel } from "./labels";
import type { GraphDocument, ProjectDocument, StoryEdge, StoryNode } from "./types";

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
    "Branching screenplay. Each beat is written in full the first time it appears. Later visits point back to it with an arrow. Scene notes are block quotes. Transitions show their conditions and variable changes in words, not code.",
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
  const entries = entryNodes(graph);
  const roots = entries.length > 0 ? entries : graph.nodes;
  for (const entry of roots) writeNode(graph, entry, level, lines, seen, project, graphs);
  if (entries.length > 0) {
    for (const node of graph.nodes) {
      if (!seen.has(key(graph, node))) {
        lines.push("_Not reached by a transition._", "");
        writeNode(graph, node, level, lines, seen, project, graphs);
      }
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
    lines.push(`→ Continues at **${beatLabel(node, project)}**.`, "");
    return;
  }
  seen.add(id);
  lines.push(heading(level, beatLabel(node, project)), "");
  if (node.summary.trim()) {
    lines.push(node.summary.trim(), "");
  }
  if (node.sceneNotes.trim()) {
    lines.push(...quote(node.sceneNotes), "");
  }
  if (node.effects.length > 0) {
    lines.push(`*On enter: ${node.effects.map((effect) => describeEffect(effect, project)).join("; ")}.*`, "");
  }
  for (const line of node.lines) {
    const speaker = speakerName(project, line.speakerId).toUpperCase();
    lines.push(`**${speaker}**`);
    if (line.direction.trim()) lines.push(`*(${line.direction.trim()})*`);
    lines.push("", line.text.trim() || "…", "");
  }
  if (node.subgraphId && graphs[node.subgraphId]) {
    const child = graphs[node.subgraphId];
    lines.push(`*Sub-graph: ${child.name.trim() || beatLabel(node, project)}*`, "");
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
  const outgoing = graph.edges.filter((edge) => edge.source === node.id);
  const branching = outgoing.length > 1;
  if (branching) lines.push(`**Transitions from ${beatLabel(node, project)}**`, "");
  for (const edge of outgoing) {
    const target = graph.nodes.find((item) => item.id === edge.target);
    if (branching || hasLogic(edge)) writeTransition(edge, target, lines, project);
    if (target) writeNode(graph, target, level, lines, seen, project, graphs);
  }
}

function hasLogic(edge: StoryEdge): boolean {
  return Boolean(edge.label || edge.condition);
}

function writeTransition(
  edge: StoryEdge,
  target: StoryNode | undefined,
  lines: string[],
  project: ProjectDocument,
) {
  const title = target ? beatLabel(target, project) : "Missing beat";
  const heading = edge.label ? `${edge.label} → ${title}` : `→ ${title}`;
  lines.push(`**${heading}**`);
  lines.push(`*When ${describeCondition(edge.condition, project)}.*`, "");
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
