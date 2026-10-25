import { useEffect, useMemo, type MouseEvent as ReactMouseEvent } from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Node,
  type NodeChange,
  type EdgeChange,
  type NodeProps,
} from "@xyflow/react";
import { describeCondition } from "../domain/conditions";
import { parallelOffset } from "../domain/edgeGeometry";
import { describeEffect } from "../domain/effects";
import { LOCATION_LANE_WIDTH, locationLaneFrame, locationPlacement } from "../domain/locations";
import type { GraphDocument, ProjectDocument } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { useContextMenu } from "./ContextMenu";
import { addBeatItems, connectBeatItems, edgeItems } from "./menuItems";
import { StoryNodeCard, type StoryFlowNode } from "./StoryNodeCard";
import { TransitionEdge, type TransitionFlowEdge } from "./TransitionEdge";

type LaneNode = Node<{ name: string }, "lane">;
type CanvasNode = StoryFlowNode | LaneNode;

const nodeTypes = { story: StoryNodeCard, lane: LaneLabel };
const edgeTypes = { transition: TransitionEdge };

export function GraphCanvas() {
  const graph = useProjectStore((state) => (state.currentGraphId ? state.graphs[state.currentGraphId] : null));
  const project = useProjectStore((state) => state.project);
  const mode = useProjectStore((state) => state.canvasMode);
  if (!graph || !project) return null;
  return (
    <ReactFlowProvider>
      <CanvasBody key={`${graph.id}:${mode}`} graph={graph} project={project} mode={mode} />
    </ReactFlowProvider>
  );
}

function LaneLabel({ data }: NodeProps<LaneNode>) {
  return <div className="sp-lane-title">{data.name}</div>;
}

function CanvasBody({
  graph,
  project,
  mode,
}: {
  graph: GraphDocument;
  project: ProjectDocument;
  mode: "graph" | "locations";
}) {
  const selection = useProjectStore((state) => state.selection);
  const select = useProjectStore((state) => state.select);
  const connectNodes = useProjectStore((state) => state.connectNodes);
  const updateNodePosition = useProjectStore((state) => state.updateNodePosition);
  const deleteNodes = useProjectStore((state) => state.deleteNodes);
  const deleteEdges = useProjectStore((state) => state.deleteEdges);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const openMenu = useContextMenu((state) => state.open);
  const closeMenu = useContextMenu((state) => state.close);
  const arranging = mode === "locations";

  const onPaneMenu = (event: ReactMouseEvent | MouseEvent) => {
    event.preventDefault();
    if (arranging) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    openMenu(event.clientX, event.clientY, addBeatItems(position));
  };

  const [nodes, setNodes] = useNodesState<CanvasNode>(toNodes(graph, project, mode));
  const [edges, setEdges] = useEdgesState(toEdges(graph, project));

  const signature = useMemo(
    () =>
      JSON.stringify({
        nodes: graph.nodes.map(({ position: _position, ...rest }) => rest),
        edges: graph.edges,
        variables: project.variables,
        tags: project.tagCategories,
        mode,
      }),
    [graph, project, mode],
  );

  useEffect(() => {
    const frame = window.setTimeout(() => fitView({ padding: 0.08, duration: 180 }), 40);
    return () => window.clearTimeout(frame);
  }, [graph.id, mode, fitView]);

  useEffect(() => {
    const pane = document.querySelector(".sp-canvas .react-flow__renderer");
    if (!pane) return;
    // d3 zoom listens for dblclick on the renderer during bubble. Stopping it
    // in capture keeps pane zoom and skips it when the click lands on a node.
    const stopNodeZoom = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".react-flow__node")) event.stopPropagation();
    };
    pane.addEventListener("dblclick", stopNodeZoom, true);
    return () => pane.removeEventListener("dblclick", stopNodeZoom, true);
  }, []);

  useEffect(() => {
    setNodes((current) => {
      const next = toNodes(graph, project, mode);
      if (mode === "locations") return next;
      return next.map((node) => {
        const previous = current.find((item) => item.id === node.id);
        return previous ? { ...node, position: previous.position } : node;
      });
    });
    setEdges(toEdges(graph, project));
    // Signature tracks content other than drag position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, setNodes, setEdges]);

  useEffect(() => {
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        selected: node.type === "story" && selection?.kind === "node" && selection.id === node.id,
      })),
    );
    setEdges((current) =>
      current.map((edge) => ({
        ...edge,
        selected: selection?.kind === "edge" && selection.id === edge.id,
      })),
    );
  }, [selection, setNodes, setEdges]);

  const onNodesChange = (changes: NodeChange<CanvasNode>[]) => {
    const next = arranging ? changes.filter((change) => change.type !== "position") : changes;
    setNodes((current) => applyNodeChanges(next, current));
  };
  const onEdgesChange = (changes: EdgeChange<TransitionFlowEdge>[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  };

  return (
    <div className="sp-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={(connection) => {
          if (!connection.source || !connection.target || connection.source.startsWith("lane:")) return;
          connectNodes(connection.source, connection.target);
        }}
        onConnectEnd={(event, connection) => {
          if (arranging || !connection.fromNode || connection.toNode || droppedOnNode(event)) return;
          const point = "changedTouches" in event ? event.changedTouches[0] : event;
          if (!point) return;
          const position = screenToFlowPosition({ x: point.clientX, y: point.clientY });
          openMenu(point.clientX, point.clientY, connectBeatItems(connection.fromNode.id, position));
        }}
        onNodeClick={(_, node) => {
          if (node.type !== "story") return;
          select({ kind: "node", id: node.id });
        }}
        onEdgeClick={(_, edge) => select({ kind: "edge", id: edge.id })}
        onEdgeContextMenu={(event, edge) => {
          event.preventDefault();
          event.stopPropagation();
          select({ kind: "edge", id: edge.id });
          openMenu(event.clientX, event.clientY, edgeItems(edge.id));
        }}
        onPaneClick={() => select(null)}
        onPaneContextMenu={onPaneMenu}
        onMoveStart={closeMenu}
        onNodeDragStop={(_, node) => {
          if (arranging || node.type !== "story") return;
          updateNodePosition(node.id, node.position);
        }}
        onNodesDelete={(deleted) => deleteNodes(deleted.filter((node) => node.type === "story").map((node) => node.id))}
        onEdgesDelete={(deleted) => deleteEdges(deleted.map((edge) => edge.id))}
        nodesDraggable={!arranging}
        connectionRadius={90}
        deleteKeyCode={["Backspace", "Delete"]}
        colorMode="dark"
        fitView
        proOptions={{ hideAttribution: false }}
      >
        <Background color="#3a342c" gap={20} size={1.1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

function droppedOnNode(event: MouseEvent | TouchEvent): boolean {
  const point = "changedTouches" in event ? event.changedTouches[0] : event;
  if (!point) return false;
  return document.elementsFromPoint(point.clientX, point.clientY).some((element) => element.closest(".react-flow__node"));
}

function toNodes(graph: GraphDocument, project: ProjectDocument, mode: "graph" | "locations"): CanvasNode[] {
  if (mode === "graph") {
    return graph.nodes.map((story) => ({
      id: story.id,
      type: "story",
      position: story.position,
      data: { story },
    }));
  }
  const placed = locationPlacement(graph, project);
  const lanes: LaneNode[] = locationLaneFrame(graph, project).map((lane) => ({
    id: `lane:${lane.id}`,
    type: "lane",
    position: { x: lane.x, y: 0 },
    data: { name: lane.name },
    style: { width: LOCATION_LANE_WIDTH, height: lane.height },
    selectable: false,
    draggable: false,
    connectable: false,
    focusable: false,
  }));
  const stories: StoryFlowNode[] = graph.nodes.map((story) => ({
    id: story.id,
    type: "story",
    position: placed.get(story.id) ?? story.position,
    data: { story },
    draggable: false,
    zIndex: 1,
  }));
  return [...lanes, ...stories];
}

function toEdges(graph: GraphDocument, project: ProjectDocument): TransitionFlowEdge[] {
  return graph.edges.map((edge) => {
    const color = "#8a7d6c";
    return {
      id: edge.id,
      type: "transition",
      source: edge.source,
      target: edge.target,
      sourceHandle: "out",
      targetHandle: "in",
      data: {
        label: edge.label,
        condition: edge.condition ? describeCondition(edge.condition, project) : "",
        effects: edge.effects.map((effect) => describeEffect(effect, project)).join(", "),
        offset: parallelOffset(graph.edges, edge.id),
      },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
      style: { stroke: color, strokeWidth: 1.6 },
    };
  });
}
