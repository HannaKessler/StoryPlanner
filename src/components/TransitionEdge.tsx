import type { MouseEvent as ReactMouseEvent } from "react";
import { BaseEdge, EdgeLabelRenderer, type Edge, type EdgeProps } from "@xyflow/react";
import { transitionCurve, type HandleSide } from "../domain/edgeGeometry";
import { useProjectStore } from "../store/projectStore";
import { edgeItems } from "./menuItems";
import { useContextMenu } from "./ContextMenu";

export type TransitionEdgeData = Record<string, unknown> & {
  label: string;
  condition: string;
  effects: string;
  offset: number;
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
  const openMenu = useContextMenu((state) => state.open);
  const { path, labelX, labelY } = transitionCurve(
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition as HandleSide,
    targetPosition as HandleSide,
    data?.offset ?? 0,
  );
  const show = data && (data.label || data.condition);
  const openEdgeMenu = (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    select({ kind: "edge", id });
    openMenu(event.clientX, event.clientY, edgeItems(id));
  };
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ ...style, stroke: selected ? "var(--accent)" : style?.stroke, strokeWidth: selected ? 2.2 : style?.strokeWidth }}
        interactionWidth={22}
      />
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
            onContextMenu={openEdgeMenu}
          >
            {data.label && <strong>{data.label}</strong>}
            {data.condition && <span className="sp-edge-if">if {data.condition}</span>}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
