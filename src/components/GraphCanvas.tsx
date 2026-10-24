import { useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import type { GraphDocument } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { StoryNodeCard, type StoryFlowNode } from "./StoryNodeCard";

const nodeTypes = { story: StoryNodeCard };

const NODE_COLORS: Record<string, string> = {
  start: "#9cba92",
  event: "#e3a15a",
  scene: "#8eb4c8",
  dialogue: "#b7a4d6",
  end: "#d4897a",
};

export function GraphCanvas() {
  const graph = useProjectStore((state) => (state.currentGraphId ? state.graphs[state.currentGraphId] : null));
  if (!graph) return null;
  return (
    <ReactFlowProvider>
      <CanvasBody key={graph.id} graph={graph} />
    </ReactFlowProvider>
  );
}

function CanvasBody({ graph }: { graph: GraphDocument }) {
  const selection = useProjectStore((state) => state.selection);
  const select = useProjectStore((state) => state.select);
  const connectNodes = useProjectStore((state) => state.connectNodes);
  const updateNodePosition = useProjectStore((state) => state.updateNodePosition);
  const deleteNodes = useProjectStore((state) => state.deleteNodes);
  const deleteEdges = useProjectStore((state) => state.deleteEdges);
  const { fitView } = useReactFlow();

  const [nodes, setNodes] = useNodesState(toNodes(graph));
  const [edges, setEdges] = useEdgesState(toEdges(graph));

  const signature = useMemo(
    () =>
      JSON.stringify({
        nodes: graph.nodes.map(({ position: _position, ...rest }) => rest),
        edges: graph.edges,
      }),
    [graph],
  );

  useEffect(() => {
    const frame = window.setTimeout(() => fitView({ padding: 0.18, duration: 180 }), 40);
    return () => window.clearTimeout(frame);
  }, [graph.id, fitView]);

  useEffect(() => {
    setNodes((current) =>
      toNodes(graph).map((node) => {
        const previous = current.find((item) => item.id === node.id);
        return previous ? { ...node, position: previous.position } : node;
      }),
    );
    setEdges(toEdges(graph));
    // Signature tracks content other than drag position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, setNodes, setEdges]);

  useEffect(() => {
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        selected: selection?.kind === "node" && selection.id === node.id,
      })),
    );
    setEdges((current) =>
      current.map((edge) => ({
        ...edge,
        selected: selection?.kind === "edge" && selection.id === edge.id,
      })),
    );
  }, [selection, setNodes, setEdges]);

  const onNodesChange = (changes: NodeChange<StoryFlowNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  };
  const onEdgesChange = (changes: EdgeChange<Edge>[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  };

  return (
    <div className="sp-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={(connection) => {
          if (!connection.source || !connection.target) return;
          connectNodes(connection.source, connection.target, connection.sourceHandle);
        }}
        onNodeClick={(_, node) => select({ kind: "node", id: node.id })}
        onEdgeClick={(_, edge) => select({ kind: "edge", id: edge.id })}
        onPaneClick={() => select(null)}
        onNodeDragStop={(_, node) => updateNodePosition(node.id, node.position)}
        onNodesDelete={(deleted) => deleteNodes(deleted.map((node) => node.id))}
        onEdgesDelete={(deleted) => deleteEdges(deleted.map((edge) => edge.id))}
        deleteKeyCode={["Backspace", "Delete"]}
        colorMode="dark"
        fitView
        proOptions={{ hideAttribution: false }}
      >
        <Background color="#3a342c" gap={20} size={1.1} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => NODE_COLORS[(node.data as { story?: { type?: string } }).story?.type ?? ""] ?? "#5c5348"}
          maskColor="rgba(18, 17, 15, 0.7)"
        />
      </ReactFlow>
    </div>
  );
}

function toNodes(graph: GraphDocument): StoryFlowNode[] {
  return graph.nodes.map((story) => ({
    id: story.id,
    type: "story",
    position: story.position,
    data: { story },
  }));
}

function toEdges(graph: GraphDocument): Edge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.choiceId ?? "out",
    targetHandle: "in",
    label: edge.label || (edge.condition ? "If" : undefined),
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: edge.condition ? "#e3a15a" : "#8a7d6c" },
    style: { stroke: edge.condition ? "#e3a15a" : "#8a7d6c", strokeWidth: 1.6 },
    labelStyle: { fill: "#d9d0c3", fontSize: 11 },
    labelBgStyle: { fill: "#1c1a17" },
    labelBgPadding: [4, 2] as [number, number],
    labelBgBorderRadius: 4,
  }));
}
