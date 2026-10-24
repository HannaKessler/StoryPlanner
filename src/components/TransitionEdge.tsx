import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import { useProjectStore } from "../store/projectStore";

export type TransitionEdgeData = Record<string, unknown> & {
  label: string;
  condition: string;
  effects: string;
};
export type TransitionFlowEdge = Edge<TransitionEdgeData, "transition">;

export function TransitionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
  selected,
}: EdgeProps<TransitionFlowEdge>) {
  const select = useProjectStore((state) => state.select);
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const show = data && (data.label || data.condition);
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} interactionWidth={18} />
      {show && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className={`sp-edge-label nodrag nopan${selected ? " is-selected" : ""}`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            title={[data.condition && `If ${data.condition}`, data.effects && `Then ${data.effects}`].filter(Boolean).join("\n")}
            onClick={(event) => {
              event.stopPropagation();
              select({ kind: "edge", id });
            }}
          >
            {data.label && <strong>{data.label}</strong>}
            {data.condition && <span className="sp-edge-if">if {data.condition}</span>}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
