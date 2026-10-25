export type HandleSide = "left" | "right" | "top" | "bottom";

/** Vertical gap between parallel transitions that share a source and a target. */
export const PARALLEL_GAP = 48;

/** Signed offset for one edge among the transitions that share its two beats. */
export function parallelOffset(edges: Array<{ id: string; source: string; target: string }>, edgeId: string, gap = PARALLEL_GAP): number {
  const edge = edges.find((item) => item.id === edgeId);
  if (!edge) return 0;
  const siblings = edges.filter((item) => item.source === edge.source && item.target === edge.target);
  if (siblings.length < 2) return 0;
  const index = siblings.findIndex((item) => item.id === edgeId);
  return (index - (siblings.length - 1) / 2) * gap;
}

function controlOffset(distance: number, curvature: number): number {
  if (distance >= 0) return 0.5 * distance;
  return curvature * 25 * Math.sqrt(-distance);
}

function control(side: HandleSide, x1: number, y1: number, x2: number, y2: number, curvature: number): [number, number] {
  switch (side) {
    case "left":
      return [x1 - controlOffset(x1 - x2, curvature), y1];
    case "right":
      return [x1 + controlOffset(x2 - x1, curvature), y1];
    case "top":
      return [x1, y1 - controlOffset(y1 - y2, curvature)];
    case "bottom":
      return [x1, y1 + controlOffset(y2 - y1, curvature)];
  }
}

/**
 * Bezier for a transition. A non-zero offset bows the control points apart so
 * parallel transitions stay apart while both ends stay on their handles.
 */
export function transitionCurve(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourceSide: HandleSide,
  targetSide: HandleSide,
  offset: number,
): { path: string; labelX: number; labelY: number } {
  const curvature = 0.25;
  let [sourceControlX, sourceControlY] = control(sourceSide, sourceX, sourceY, targetX, targetY, curvature);
  let [targetControlX, targetControlY] = control(targetSide, targetX, targetY, sourceX, sourceY, curvature);
  if (offset) {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const length = Math.hypot(dx, dy) || 1;
    sourceControlX += (-dy / length) * offset;
    sourceControlY += (dx / length) * offset;
    targetControlX += (-dy / length) * offset;
    targetControlY += (dx / length) * offset;
  }
  const labelX = sourceX * 0.125 + sourceControlX * 0.375 + targetControlX * 0.375 + targetX * 0.125;
  const labelY = sourceY * 0.125 + sourceControlY * 0.375 + targetControlY * 0.375 + targetY * 0.125;
  return {
    path: `M${sourceX},${sourceY} C${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${targetX},${targetY}`,
    labelX,
    labelY,
  };
}
