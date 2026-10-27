import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
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
import { indexInvolved, involvement } from "../domain/involved";
import { boxAt, clampInBox, locationFrames, locationIdForBox, type MeasuredSizes } from "../domain/locations";
import type { GraphDocument, ProjectDocument } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { useContextMenu } from "./ContextMenu";
import { addBeatItems, beatItems, connectBeatItems, edgeItems, registerViewCenter } from "./menuItems";
import { StoryNodeCard, type StoryFlowNode } from "./StoryNodeCard";
import { TransitionEdge, type TransitionFlowEdge } from "./TransitionEdge";

const MULTI_BOX = "multiple";

type BoxNode = Node<{ locationId: string; name: string; minWidth: number; minHeight: number }, "box">;
type CanvasNode = StoryFlowNode | BoxNode;

const nodeTypes = { story: StoryNodeCard, box: LocationBoxNode };
const edgeTypes = { transition: TransitionEdge };

export function GraphCanvas() {
  const graphs = useProjectStore((state) => state.graphs);
  const graph = useProjectStore((state) => (state.currentGraphId ? state.graphs[state.currentGraphId] : null));
  const project = useProjectStore((state) => state.project);
  const mode = useProjectStore((state) => state.canvasMode);
  if (!graph || !project) return null;
  return (
    <ReactFlowProvider>
      <CanvasBody key={`${graph.id}:${mode}`} graph={graph} graphs={graphs} project={project} mode={mode} />
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
  graphs,
  project,
  mode,
}: {
  graph: GraphDocument;
  graphs: Record<string, GraphDocument>;
  project: ProjectDocument;
  mode: "graph" | "locations";
}) {
  const selection = useProjectStore((state) => state.selection);
  const select = useProjectStore((state) => state.select);
  const connectNodes = useProjectStore((state) => state.connectNodes);
  const updateNodePosition = useProjectStore((state) => state.updateNodePosition);
  const saveLocationLayout = useProjectStore((state) => state.saveLocationLayout);
  const requestDeleteNodes = useProjectStore((state) => state.requestDeleteNodes);
  const restoreTick = useProjectStore((state) => state.restoreTick);
  const appliedTick = useRef(restoreTick);
  const { fitView, screenToFlowPosition, getNodes, getEdges } = useReactFlow();
  const openMenu = useContextMenu((state) => state.open);
  const closeMenu = useContextMenu((state) => state.close);
  const arranging = mode === "locations";

  const [sizes, setSizes] = useState<MeasuredSizes>({});

  /** Location boxes as drawn, in flow coordinates. */
  const drawnBoxes = () =>
    getNodes()
      .filter((node): node is BoxNode => node.type === "box")
      .map((node) => ({
        id: node.data.locationId,
        position: node.position,
        size: { width: node.measured?.width ?? node.width ?? 0, height: node.measured?.height ?? node.height ?? 0 },
      }));

  /** Points of the beats drawn in a box, so a change elsewhere does not restack them. */
  const drawnPositions = (boxId: string) =>
    Object.fromEntries(
      getNodes()
        .filter((node) => node.type === "story" && node.parentId === `box:${boxId}`)
        .map((node) => [node.id, { x: Math.round(node.position.x), y: Math.round(node.position.y) }]),
    );

  const onPaneMenu = (event: ReactMouseEvent | MouseEvent) => {
    event.preventDefault();
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    if (!arranging) {
      openMenu(event.clientX, event.clientY, addBeatItems(position));
      return;
    }
    // Location-view coordinates must not become a graph position. The beat goes in the box under the pointer.
    const box = boxAt(drawnBoxes(), position);
    if (!box) {
      openMenu(event.clientX, event.clientY, addBeatItems(undefined, {}));
      return;
    }
    // Beats already in the box stay where they are drawn when the new one arrives.
    const keep = drawnPositions(box.id);
    openMenu(event.clientX, event.clientY, [
      {
        label: "Add beat",
        onSelect: () => {
          saveLocationLayout({ nodePositions: keep });
          useProjectStore.getState().addNode(undefined, {
            locationId: locationIdForBox(box.id),
            locationPosition: clampInBox({ x: position.x - box.position.x, y: position.y - box.position.y }),
          });
        },
      },
    ]);
  };

  useEffect(() => {
    if (arranging) return;
    registerViewCenter(() => {
      const pane = document.querySelector(".sp-canvas");
      if (!pane) return null;
      const rect = pane.getBoundingClientRect();
      return screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    });
    return () => registerViewCenter(null);
  }, [arranging, screenToFlowPosition]);

  const [nodes, setNodes] = useNodesState<CanvasNode>(toNodes(graph, graphs, project, mode, sizes));
  const [edges, setEdges] = useEdgesState(toEdges(graph, project));

  const signature = useMemo(
    () =>
      JSON.stringify({
        nodes: graph.nodes.map(({ position: _position, ...rest }) => rest),
        edges: graph.edges,
        boxes: graph.locationBoxes,
        variables: project.variables,
        characters: project.characters,
        items: project.items,
        locations: project.locations,
        refs: Object.values(graphs).map((item) =>
          item.nodes.map((node) => [node.locationId, node.characterIds, node.itemIds, node.subgraphId, node.lines.map((line) => line.speakerId)]),
        ),
        mode,
        restoreTick,
        sizes: mode === "locations" ? sizes : null,
      }),
    [graph, graphs, project, mode, restoreTick, sizes],
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
      const next = toNodes(graph, graphs, project, mode, sizes);
      // Undo and redo also put beats back where they were.
      const restoring = appliedTick.current !== restoreTick;
      appliedTick.current = restoreTick;
      if (mode === "locations" || restoring) return next;
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

  useEffect(() => {
    // Delete and Backspace go through the store, which confirms when sub-graphs would go too.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (event.ctrlKey || event.metaKey || event.altKey || typingTarget(event.target)) return;
      const state = useProjectStore.getState();
      if (state.confirm || state.pendingClose || state.exportOpen) return;
      const nodeIds = getNodes()
        .filter((node) => node.selected && node.type === "story")
        .map((node) => node.id);
      const edgeIds = getEdges()
        .filter((edge) => edge.selected)
        .map((edge) => edge.id);
      if (nodeIds.length === 0 && edgeIds.length === 0) return;
      event.preventDefault();
      requestDeleteNodes(nodeIds, edgeIds);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [getNodes, getEdges, requestDeleteNodes]);

  const onNodesChange = (changes: NodeChange<CanvasNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
    if (!arranging) return;
    // Boxes are sized from the cards as drawn, once React Flow has measured them.
    const measured: MeasuredSizes = {};
    for (const change of changes) {
      if (change.type !== "dimensions" || !change.dimensions || change.id.startsWith("box:")) continue;
      measured[change.id] = { width: Math.round(change.dimensions.width), height: Math.round(change.dimensions.height) };
    }
    if (Object.keys(measured).length === 0) return;
    setSizes((current) => {
      const changed = Object.entries(measured).some(
        ([id, size]) => current[id]?.width !== size.width || current[id]?.height !== size.height,
      );
      return changed ? { ...current, ...measured } : current;
    });
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
          if (node.type === "box") {
            onPaneMenu(event);
            return;
          }
          if (node.type !== "story") return;
          select({ kind: "node", id: node.id });
          openMenu(event.clientX, event.clientY, beatItems(node.data.story));
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
            const parent = getNodes().find((item) => item.id === node.parentId);
            const origin = parent?.position ?? { x: 0, y: 0 };
            const width = node.measured?.width ?? 0;
            const height = node.measured?.height ?? 0;
            const absolute = { x: origin.x + node.position.x, y: origin.y + node.position.y };
            const center = { x: absolute.x + width / 2, y: absolute.y + height / 2 };
            const target = boxAt(drawnBoxes(), center);
            const currentBox = parent?.type === "box" ? (parent as BoxNode).data.locationId : null;
            if (target && target.id !== currentBox && target.id !== MULTI_BOX) {
              // Dropping into another box moves the beat to that location.
              useProjectStore
                .getState()
                .moveToLocation(
                  node.id,
                  locationIdForBox(target.id),
                  clampInBox({ x: absolute.x - target.position.x, y: absolute.y - target.position.y }),
                  drawnPositions(target.id),
                );
              return;
            }
            saveLocationLayout({ nodePositions: { [node.id]: clampInBox(node.position) } });
            return;
          }
          updateNodePosition(node.id, node.position);
        }}
        onBeforeDelete={async () => false}
        nodesDraggable
        connectionRadius={90}
        deleteKeyCode={null}
        colorMode="dark"
        minZoom={0.1}
        maxZoom={2}
        fitView
        proOptions={{ hideAttribution: false }}
      >
        <Background color="#3a342c" gap={20} size={1.1} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          ariaLabel="Overview"
          style={{ width: 160, height: 110 }}
          bgColor="#12110f"
          maskColor="rgba(8, 7, 6, 0.6)"
          nodeColor={(node) => (node.type === "box" ? "transparent" : "#5c5348")}
          nodeStrokeColor={(node) => (node.type === "box" ? "#3a342c" : "transparent")}
          nodeBorderRadius={3}
        />
      </ReactFlow>
    </div>
  );
}

function typingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

function droppedOnNode(event: MouseEvent | TouchEvent): boolean {
  const point = "changedTouches" in event ? event.changedTouches[0] : event;
  if (!point) return false;
  return document.elementsFromPoint(point.clientX, point.clientY).some((element) => element.closest(".react-flow__node"));
}

function toNodes(
  graph: GraphDocument,
  graphs: Record<string, GraphDocument>,
  project: ProjectDocument,
  mode: "graph" | "locations",
  sizes: MeasuredSizes = {},
): CanvasNode[] {
  const involved = indexInvolved(graphs);
  const dataFor = (story: GraphDocument["nodes"][number]) => ({
    story,
    involvement: involvement(involved, graph.id, story.id),
  });
  if (mode === "graph") {
    return graph.nodes.map((story) => ({
      id: story.id,
      type: "story",
      position: story.position,
      data: dataFor(story),
    }));
  }
  const boxes: BoxNode[] = [];
  const stories: StoryFlowNode[] = [];
  for (const frame of locationFrames(graph, project, graphs, sizes)) {
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
        position: item.position,
        data: dataFor(story),
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
        offset: parallelOffset(graph.edges, edge.id),
      },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
      style: { stroke: color, strokeWidth: 1.6 },
    };
  });
}
