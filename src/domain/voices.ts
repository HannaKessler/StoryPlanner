import { speakerName } from "./format";
import { entityLabel } from "./names";
import { graphBreadcrumbs, orderedGraphs } from "./graphOps";
import { beatLabel } from "./labels";
import type {
  DialogueLine,
  GraphDocument,
  ProjectDocument,
  StoryEdge,
  StoryNode,
} from "./types";

interface Cue {
  line: DialogueLine;
  speaker: string;
  viaLabel: string | null;
}

/**
 * One sheet per speaking character. Each of their lines is preceded by the
 * line or lines it directly answers. A line reached by more than one path
 * lists every distinct answered line.
 */
export function exportVoiceSheets(
  project: ProjectDocument,
  graphs: Record<string, GraphDocument>,
): string {
  const characters = project.characters;
  const lines: string[] = [
    "# Voice actor sheets",
    "",
    `Project: **${project.name || "Untitled story"}**`,
    "",
    "Each section is one character. Only their lines are listed. The italic line above each one is the line it directly answers. When a line answers different lines on different paths, every one of them is listed. Scene notes are included for context.",
    "",
  ];
  if (characters.length === 0) {
    lines.push("_No characters yet._", "");
    return `${lines.join("\n").trim()}\n`;
  }

  const order = orderedGraphs(project, graphs);
  for (const character of characters) {
      lines.push(`## ${entityLabel(project, character)}`, "");
      if (character.notes.trim()) lines.push(character.notes.trim(), "");
      const appearances = collectLines(order, character.id);
      if (appearances.length === 0) {
        lines.push("_No lines yet._", "");
        continue;
      }
      for (const appearance of appearances) {
        const { graph, node, line, index } = appearance;
        const cues = responseCues(graph, node, index, graphs, project);
        lines.push(`### ${line.text.trim() || "…"}`, "");
        lines.push(`*${breadcrumbLabel(graphs, graph, node, project)}*`, "");
        const notes = [node.sceneNotes, graph.sceneNotes].map((note) => note.trim()).filter(Boolean);
        for (const note of notes) lines.push(`*${note.replace(/\s+/g, " ")}*`, "");
        if (line.direction.trim()) lines.push(`*(${line.direction.trim()})*`, "");
        if (cues.length === 0) {
          lines.push("*Opening line — nothing is said before this.*", "");
        } else {
          lines.push("*Responds to:*", "");
          for (const cue of cues) {
            const via = cue.viaLabel ? ` *(then “${cue.viaLabel}”)*` : "";
            lines.push(`> **${cue.speaker}:** *${cue.line.text.trim() || "…"}*${via}`, "");
          }
        }
        lines.push(`**${entityLabel(project, character).toUpperCase()}**`, "", line.text.trim() || "…", "", "---", "");
      }
  }
  return `${lines.join("\n").trim()}\n`;
}

function collectLines(graphs: GraphDocument[], speakerTagId: string) {
  const found: Array<{ graph: GraphDocument; node: StoryNode; line: DialogueLine; index: number }> = [];
  for (const graph of graphs) {
    for (const node of graph.nodes) {
      node.lines.forEach((line, index) => {
        if (line.speakerId === speakerTagId) found.push({ graph, node, line, index });
      });
    }
  }
  return found;
}

function breadcrumbLabel(
  graphs: Record<string, GraphDocument>,
  graph: GraphDocument,
  node: StoryNode,
  project: ProjectDocument,
): string {
  const crumbs = graphBreadcrumbs(graphs, graph.id, project).map((crumb) => crumb.name);
  crumbs.push(beatLabel(node, project));
  return crumbs.join(" → ");
}

export function responseCues(
  graph: GraphDocument,
  node: StoryNode,
  lineIndex: number,
  graphs: Record<string, GraphDocument>,
  project: ProjectDocument,
): Cue[] {
  if (lineIndex > 0) {
    const previous = node.lines[lineIndex - 1];
    return [makeCue(project, previous, null)];
  }
  return dedupe(incomingCues(graph, node, graphs, project, new Set()));
}

function incomingCues(
  graph: GraphDocument,
  node: StoryNode,
  graphs: Record<string, GraphDocument>,
  project: ProjectDocument,
  guard: Set<string>,
): Cue[] {
  const visit = `${graph.id}:${node.id}`;
  if (guard.has(visit)) return [];
  const nextGuard = new Set(guard);
  nextGuard.add(visit);
  const incoming = graph.edges.filter((edge) => edge.target === node.id);
  if (incoming.length === 0) return cuesBeforeGraph(graph, graphs, project, nextGuard);
  const cues: Cue[] = [];
  for (const edge of incoming) {
    const source = graph.nodes.find((item) => item.id === edge.source);
    if (!source) continue;
    cues.push(...tailCues(graph, source, edge, graphs, project, nextGuard));
  }
  return cues;
}

function tailCues(
  graph: GraphDocument,
  node: StoryNode,
  viaEdge: StoryEdge | null,
  graphs: Record<string, GraphDocument>,
  project: ProjectDocument,
  guard: Set<string>,
): Cue[] {
  const visit = `tail:${graph.id}:${node.id}`;
  if (guard.has(visit)) return [];
  const nextGuard = new Set(guard);
  nextGuard.add(visit);
  const via = transitionLabel(viaEdge);

  if (node.subgraphId && graphs[node.subgraphId]) {
    const child = graphs[node.subgraphId];
    const terminals = child.nodes.filter((item) => !child.edges.some((edge) => edge.source === item.id));
    const nested: Cue[] = [];
    for (const terminal of terminals) {
      nested.push(...tailCues(child, terminal, null, graphs, project, nextGuard));
    }
    if (nested.length) {
      return nested.map((cue) => ({ ...cue, viaLabel: cue.viaLabel ?? via }));
    }
  }

  if (node.lines.length > 0) {
    return [makeCue(project, node.lines[node.lines.length - 1], via)];
  }
  return incomingCues(graph, node, graphs, project, nextGuard).map((cue) => ({
    ...cue,
    viaLabel: cue.viaLabel ?? via,
  }));
}

function cuesBeforeGraph(
  graph: GraphDocument,
  graphs: Record<string, GraphDocument>,
  project: ProjectDocument,
  guard: Set<string>,
): Cue[] {
  if (!graph.parentGraphId || !graph.parentNodeId) return [];
  const parent = graphs[graph.parentGraphId];
  const parentNode = parent?.nodes.find((item) => item.id === graph.parentNodeId);
  if (!parent || !parentNode) return [];
  if (parentNode.lines.length > 0) {
    return [makeCue(project, parentNode.lines[parentNode.lines.length - 1], null)];
  }
  return incomingCues(parent, parentNode, graphs, project, guard);
}

function transitionLabel(edge: StoryEdge | null): string | null {
  return edge?.label || null;
}

function makeCue(project: ProjectDocument, line: DialogueLine, viaLabel: string | null): Cue {
  return {
    line,
    speaker: speakerName(project, line.speakerId),
    viaLabel,
  };
}

function dedupe(cues: Cue[]): Cue[] {
  const seen = new Set<string>();
  const result: Cue[] = [];
  for (const cue of cues) {
    const key = `${cue.line.id}:${cue.viaLabel ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cue);
  }
  return result;
}
