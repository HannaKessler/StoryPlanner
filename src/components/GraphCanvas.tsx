import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
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
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import { describeCondition } from "../domain/conditions";
import { describeEffect } from "../domain/effects";
import { addableNodeTypes } from "../domain/graphOps";
import { NODE_LABEL } from "../domain/labels";
import type { GraphDocument, ProjectDocument } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { StoryNodeCard, type StoryFlowNode } from "./StoryNodeCard";
import { TransitionEdge, type TransitionFlowEdge } from "./TransitionEdge";

const nodeTypes = { story: StoryNodeCard };
const edgeTypes = { transition: TransitionEdge };

export function GraphCanvas() {
  const graph = useProjectStore((state) => (state.currentGraphId ? state.graphs[state.currentGraphId] : null));
  const project = useProjectStore((state) => state.project);
  if (!graph || !project) return null;
  return (
    <ReactFlowProvider>
      <CanvasBody key={graph.id} graph={graph} project={project} />
    </ReactFlowProvider>
  );
}

function CanvasBody({ graph, project }: { graph: GraphDocument; project: ProjectDocument }) {
  const selection = useProjectStore((state) => state.selection);
  const select = useProjectStore((state) => state.select);
  const connectNodes = useProjectStore((state) => state.connectNodes);
  const updateNodePosition = useProjectStore((state) => state.updateNodePosition);
  const deleteNodes = useProjectStore((state) => state.deleteNodes);
  const deleteEdges = useProjectStore((state) => state.deleteEdges);
  const addNode = useProjectStore((state) => state.addNode);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ left: number; top: number; flow: { x: number; y: number } } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenu(null);
    const onDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown, true);
    };
  }, [menu]);

  const openMenu = (event: ReactMouseEvent | MouseEvent) => {
    event.preventDefault();
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const types = addableNodeTypes(graph).length;
    const left = Math.min(event.clientX - bounds.left, bounds.width - 128);
    const top = Math.min(event.clientY - bounds.top, bounds.height - (types * 24 + 10));
    setMenu({ left, top, flow: screenToFlowPosition({ x: event.clientX, y: event.clientY }) });
  };

  const [nodes, setNodes] = useNodesState(toNodes(graph));
  const [edges, setEdges] = useEdgesState(toEdges(graph, project));

  const signature = useMemo(
    () =>
      JSON.stringify({
        nodes: graph.nodes.map(({ position: _position, ...rest }) => rest),
        edges: graph.edges,
        variables: project.variables,
        tags: project.tagCategories,
      }),
    [graph, project],
  );

  useEffect(() => {
    const frame = window.setTimeout(() => fitView({ padding: 0.08, duration: 180 }), 40);
    return () => window.clearTimeout(frame);
  }, [graph.id, fitView]);

  useEffect(() => {
    setNodes((current) =>
      toNodes(graph).map((node) => {
        const previous = current.find((item) => item.id === node.id);
        return previous ? { ...node, position: previous.position } : node;
      }),
    );
    setEdges(toEdges(graph, project));
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
  const onEdgesChange = (changes: EdgeChange<TransitionFlowEdge>[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  };

  return (
    <div className="sp-canvas" ref={canvasRef} onContextMenu={(event) => event.preventDefault()}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={(connection) => {
          if (!connection.source || !connection.target) return;
          connectNodes(connection.source, connection.target);
        }}
        onNodeClick={(_, node) => select({ kind: "node", id: node.id })}
        onEdgeClick={(_, edge) => select({ kind: "edge", id: edge.id })}
        onPaneClick={() => select(null)}
        onPaneContextMenu={openMenu}
        onMoveStart={() => setMenu(null)}
        onNodeDragStop={(_, node) => updateNodePosition(node.id, node.position)}
        onNodesDelete={(deleted) => deleteNodes(deleted.map((node) => node.id))}
        onEdgesDelete={(deleted) => deleteEdges(deleted.map((edge) => edge.id))}
        connectionRadius={90}
        deleteKeyCode={["Backspace", "Delete"]}
        colorMode="dark"
        fitView
        proOptions={{ hideAttribution: false }}
      >
        <Background color="#3a342c" gap={20} size={1.1} />
        <Controls showInteractive={false} />
      </ReactFlow>
      {menu && (
        <div ref={menuRef} className="sp-context" role="menu" style={{ left: menu.left, top: menu.top }}>
          {addableNodeTypes(graph).map((type) => (
            <button
              key={type}
              type="button"
              role="menuitem"
              onClick={() => {
                addNode(type, menu.flow);
                setMenu(null);
              }}
            >
              {NODE_LABEL[type]}
            </button>
          ))}
        </div>
      )}
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
      },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
      style: { stroke: color, strokeWidth: 1.6 },
    };
  });
}
