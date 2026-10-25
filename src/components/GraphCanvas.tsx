import { useEffect, useMemo, type MouseEvent as ReactMouseEvent } from "react";
import {
  Background,
  Controls,
  MarkerType,
  NodeResizer,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useEdgesState,
  useNodesState,
  useNodeId,
  useReactFlow,
  type Node,
  type NodeChange,
  type EdgeChange,
  type NodeProps,
} from "@xyflow/react";
import { describeCondition } from "../domain/conditions";
import { parallelOffset } from "../domain/edgeGeometry";
import { describeEffect } from "../domain/effects";
import { locationFrames } from "../domain/locations";
import type { GraphDocument, ProjectDocument } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { useContextMenu } from "./ContextMenu";
import { addBeatItems, connectBeatItems, edgeItems, nodeGraphItems } from "./menuItems";
import { StoryNodeCard, type StoryFlowNode } from "./StoryNodeCard";
import { TransitionEdge, type TransitionFlowEdge } from "./TransitionEdge";

type BoxNode = Node<{ locationId: string; name: string; minWidth: number; minHeight: number }, "box">;
type CanvasNode = StoryFlowNode | BoxNode;

const nodeTypes = { story: StoryNodeCard, box: LocationBoxNode };
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

function LocationBoxNode({ data, selected }: NodeProps<BoxNode>) {
  const nodeId = useNodeId();
  const { getNodes } = useReactFlow();
  const saveLocationLayout = useProjectStore((state) => state.saveLocationLayout);
  return (
    <div className="sp-box">
      <NodeResizer
        isVisible={selected}
        minWidth={data.minWidth}
        minHeight={data.minHeight}
        lineStyle={{ borderColor: "transparent" }}
        handleStyle={{ width: 8, height: 8, border: "none", borderRadius: 1, background: "#8b8174" }}
        onResizeEnd={(_, params) => {
          const children = getNodes().filter((node) => node.parentId === nodeId);
          saveLocationLayout({
            box: {
              id: data.locationId,
              position: { x: Math.round(params.x), y: Math.round(params.y) },
              size: { width: Math.round(params.width), height: Math.round(params.height) },
            },
            nodePositions: Object.fromEntries(
              children.map((node) => [node.id, { x: Math.round(node.position.x), y: Math.round(node.position.y) }]),
            ),
          });
        }}
      />
      <div className="sp-box-title">{data.name}</div>
    </div>
  );
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
  const saveLocationLayout = useProjectStore((state) => state.saveLocationLayout);
  const deleteNodes = useProjectStore((state) => state.deleteNodes);
  const deleteEdges = useProjectStore((state) => state.deleteEdges);
  const { fitView, screenToFlowPosition, getNodes } = useReactFlow();
  const openMenu = useContextMenu((state) => state.open);
  const closeMenu = useContextMenu((state) => state.close);
  const arranging = mode === "locations";

  const onPaneMenu = (event: ReactMouseEvent | MouseEvent) => {
    event.preventDefault();
    // A pane click here is in location-view coordinates, which must not become a graph position.
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
        boxes: graph.locationBoxes,
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
    // Signature tracks content other than the graph-view drag position.
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
    setNodes((current) => applyNodeChanges(changes, current));
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
          if (!connection.source || !connection.target || connection.source.startsWith("box:")) return;
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
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          if (node.type !== "story") return;
          const items = nodeGraphItems(node.data.story);
          if (items.length === 0) return;
          select({ kind: "node", id: node.id });
          openMenu(event.clientX, event.clientY, items);
        }}
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
          if (node.type === "box") {
            const width = node.measured?.width ?? node.width ?? 0;
            const height = node.measured?.height ?? node.height ?? 0;
            if (width < 1 || height < 1) return;
            saveLocationLayout({
              box: {
                id: node.data.locationId,
                position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
                size: { width: Math.round(width), height: Math.round(height) },
              },
            });
            return;
          }
          if (node.type !== "story") return;
          if (arranging) {
            saveLocationLayout({
              nodePositions: { [node.id]: { x: Math.round(node.position.x), y: Math.round(node.position.y) } },
            });
            const parent = getNodes().find((item) => item.id === node.parentId);
            if (parent?.type === "box") {
              const box = parent as BoxNode;
              const width = box.measured?.width ?? box.width ?? 0;
              const height = box.measured?.height ?? box.height ?? 0;
              if (width > 0 && height > 0) {
                saveLocationLayout({
                  box: {
                    id: box.data.locationId,
                    position: { x: Math.round(parent.position.x), y: Math.round(parent.position.y) },
                    size: { width: Math.round(width), height: Math.round(height) },
                  },
                });
              }
            }
            return;
          }
          updateNodePosition(node.id, node.position);
        }}
        onNodesDelete={(deleted) => deleteNodes(deleted.filter((node) => node.type === "story").map((node) => node.id))}
        onEdgesDelete={(deleted) => deleteEdges(deleted.map((edge) => edge.id))}
        nodesDraggable
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
  const boxes: BoxNode[] = [];
  const stories: StoryFlowNode[] = [];
  for (const frame of locationFrames(graph, project)) {
    const boxId = `box:${frame.id}`;
    boxes.push({
      id: boxId,
      type: "box",
      position: frame.position,
      width: frame.size.width,
      height: frame.size.height,
      style: { width: frame.size.width, height: frame.size.height },
      data: { locationId: frame.id, name: frame.name, minWidth: frame.minWidth, minHeight: frame.minHeight },
      dragHandle: ".sp-box-title",
      connectable: false,
      deletable: false,
      zIndex: 0,
    });
    for (const item of frame.nodes) {
      const story = graph.nodes.find((node) => node.id === item.id);
      if (!story) continue;
      stories.push({
        id: story.id,
        type: "story",
        parentId: boxId,
        extent: "parent",
        position: item.position,
        data: { story },
        zIndex: 1,
      });
    }
  }
  return [...boxes, ...stories];
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
