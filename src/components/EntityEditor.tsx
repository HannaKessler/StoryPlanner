import { useEffect, useMemo, useState } from "react";
import { readFileBytes } from "../desktop/tauri";
import { entitiesOf } from "../domain/format";
import { entityLabel, isDuplicateName, uniqueName } from "../domain/names";
import { graphName } from "../domain/graphOps";
import { beatLabel } from "../domain/labels";
import { joinPath } from "../domain/paths";
import { usedIn, type UseKind } from "../domain/usedIn";
import type { EntityKind, StoryEntity } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { focusRename, menuHandler } from "./ContextMenu";
import { IconButton, Section } from "./Panel";

const TITLES: Record<EntityKind, string> = {
  character: "Characters",
  item: "Items",
  location: "Locations",
};

export function EntityEditor({ kind }: { kind: EntityKind }) {
  const project = useProjectStore((state) => state.project);
  const addEntity = useProjectStore((state) => state.addEntity);
  const requestDeleteEntity = useProjectStore((state) => state.requestDeleteEntity);
  const [selected, setSelected] = useState<string | null>(null);
  if (!project) return null;
  const entities = entitiesOf(project, kind);
  const current = entities.find((entity) => entity.id === selected) ?? entities[0] ?? null;
  const add = () => {
    const id = addEntity(kind);
    if (!id) return;
    setSelected(id);
    focusRename(id);
  };

  return (
    <div className="sp-library">
      <div
        className="sp-library-list"
        onContextMenu={menuHandler(() => [{ label: `Add ${kind}`, onSelect: add }])}
      >
        <header className="sp-sec-head">
          <span className="sp-sec-title">{TITLES[kind]}</span>
          <span className="sp-sec-count">{entities.length}</span>
          <span className="sp-grow" />
          <button type="button" className="sp-chip-btn sp-add" aria-label={`Add ${kind}`} title={`Add ${kind}`} onClick={add}>
            +
          </button>
        </header>
        <ul className="sp-beats">
          {entities.map((entity) => (
            <li
              key={entity.id}
              className={current?.id === entity.id ? "is-active" : ""}
              onContextMenu={menuHandler(() => [
                { label: `Add ${kind}`, onSelect: add },
                "separator",
                {
                  label: "Rename",
                  onSelect: () => {
                    setSelected(entity.id);
                    focusRename(entity.id);
                  },
                },
                { label: "Delete", danger: true, onSelect: () => requestDeleteEntity(kind, entity.id) },
              ])}
            >
              <button type="button" className="sp-beat" onClick={() => setSelected(entity.id)}>
                <span className={entity.name.trim() ? "sp-beat-title" : "sp-beat-title sp-unnamed"}>{entityLabel(project, entity)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {current ? <EntityDetail key={current.id} kind={kind} entity={current} /> : <div className="sp-library-detail" />}
    </div>
  );
}

function EntityDetail({ kind, entity }: { kind: EntityKind; entity: StoryEntity }) {
  const project = useProjectStore((state) => state.project);
  const updateEntity = useProjectStore((state) => state.updateEntity);
  const otherNames = project ? entitiesOf(project, kind).filter((item) => item.id !== entity.id).map((item) => item.name) : [];
  const duplicate = isDuplicateName(entity.name, otherNames);
  const addEntityImages = useProjectStore((state) => state.addEntityImages);
  const removeEntityImage = useProjectStore((state) => state.removeEntityImage);
  return (
    <div
      className="sp-library-detail"
      onContextMenu={menuHandler(() => [
        { label: "Add image", onSelect: () => void addEntityImages(kind, entity.id) },
        { label: "Add field", onSelect: () => updateEntity(kind, entity.id, { fields: [...entity.fields, { key: "", value: "" }] }) },
      ])}
    >
      <input
        className={duplicate ? "sp-head-input is-dup" : "sp-head-input"}
        aria-label="Name"
        aria-invalid={duplicate || undefined}
        title={duplicate ? "Name in use" : undefined}
        placeholder={project ? entityLabel(project, entity) : undefined}
        data-rename={entity.id}
        value={entity.name}
        onChange={(event) => updateEntity(kind, entity.id, { name: event.target.value })}
        onBlur={() => {
          if (!duplicate) return;
          updateEntity(kind, entity.id, { name: uniqueName(entity.name, otherNames) });
        }}
      />
      <Section id={`entity:${entity.id}:notes`} title="Notes" summary={entity.notes}>
        <textarea
          className="sp-cell sp-area"
          rows={5}
          aria-label="Notes"
          value={entity.notes}
          onChange={(event) => updateEntity(kind, entity.id, { notes: event.target.value })}
        />
      </Section>
      <UsedIn kind={kind} entityId={entity.id} />
      <Section
        id={`entity:${entity.id}:images`}
        title="Images"
        count={entity.images.length}
        actions={
          <button type="button" className="sp-chip-btn" onClick={() => void addEntityImages(kind, entity.id)}>
            + image
          </button>
        }
      >
        <div className="sp-gallery">
          {entity.images.map((path) => (
            <figure
              key={path}
              onContextMenu={menuHandler(() => [
                { label: "Add image", onSelect: () => void addEntityImages(kind, entity.id) },
                "separator",
                { label: "Remove image", danger: true, onSelect: () => void removeEntityImage(kind, entity.id, path) },
              ])}
            >
              <EntityImage path={path} alt={project ? entityLabel(project, entity) : entity.name} />
              <IconButton label="Remove image" danger onClick={() => void removeEntityImage(kind, entity.id, path)}>
                ×
              </IconButton>
            </figure>
          ))}
        </div>
      </Section>
      <Section
        id={`entity:${entity.id}:fields`}
        title="Fields"
        count={entity.fields.length}
        actions={
          <button
            type="button"
            className="sp-chip-btn"
            onClick={() => updateEntity(kind, entity.id, { fields: [...entity.fields, { key: "", value: "" }] })}
          >
            + field
          </button>
        }
      >
        <ul className="sp-fields">
          {entity.fields.map((field, index) => (
            <li key={index}>
              <input
                className="sp-cell"
                aria-label="Field name"
                value={field.key}
                onChange={(event) => {
                  const fields = entity.fields.slice();
                  fields[index] = { ...field, key: event.target.value };
                  updateEntity(kind, entity.id, { fields });
                }}
              />
              <input
                className="sp-cell"
                aria-label="Field value"
                value={field.value}
                onChange={(event) => {
                  const fields = entity.fields.slice();
                  fields[index] = { ...field, value: event.target.value };
                  updateEntity(kind, entity.id, { fields });
                }}
              />
              <IconButton
                label="Delete field"
                danger
                onClick={() =>
                  updateEntity(kind, entity.id, { fields: entity.fields.filter((_, fieldIndex) => fieldIndex !== index) })
                }
              >
                ×
              </IconButton>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

const WAY_LABEL: Record<UseKind, string> = {
  location: "",
  listed: "",
  speaks: "speaks",
  effect: "effect",
  condition: "condition",
};

function UsedIn({ kind, entityId }: { kind: EntityKind; entityId: string }) {
  const project = useProjectStore((state) => state.project);
  const graphs = useProjectStore((state) => state.graphs);
  const entries = useMemo(() => (project ? usedIn(project, graphs, kind, entityId) : []), [project, graphs, kind, entityId]);
  if (!project) return null;
  return (
    <Section id={`entity:${entityId}:used`} title="Used in" count={entries.length}>
      <ul className="sp-beats sp-used">
        {entries.map((entry) => {
          const graph = graphs[entry.graphId];
          const where = graph && graph.id !== project.rootGraphId ? graphName(graph, graphs, project) : "";
          const ways = entry.ways.map((way) => WAY_LABEL[way]).filter(Boolean).join(", ");
          return (
            <li key={`${entry.graphId}:${entry.node.id}`}>
              <button type="button" className="sp-beat" onClick={() => useProjectStore.getState().selectBeat(entry.graphId, entry.node.id)}>
                <span className="sp-beat-title">{beatLabel(entry.node, project)}</span>
                {where && <span className="sp-faint">{where}</span>}
                {ways && <span className="sp-faint">{ways}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** Decoded images by full path, so switching entities does not read and encode them again. */
const imageCache = new Map<string, string>();

function EntityImage({ path, alt }: { path: string; alt: string }) {
  const projectPath = useProjectStore((state) => state.projectPath);
  const full = projectPath ? joinPath(projectPath, path) : "";
  const [src, setSrc] = useState(() => imageCache.get(full) ?? "");
  useEffect(() => {
    if (!full) return;
    const cached = imageCache.get(full);
    if (cached) {
      setSrc(cached);
      return;
    }
    let cancelled = false;
    void readFileBytes(full)
      .then((bytes) => {
        const url = `data:${mime(path)};base64,${toBase64(bytes)}`;
        imageCache.set(full, url);
        if (cancelled) return;
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc("");
      });
    return () => {
      cancelled = true;
    };
  }, [full, path]);
  if (!src) return <span className="sp-gallery-missing" />;
  return <img src={src} alt={alt} />;
}

function mime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function toBase64(bytes: number[]): string {
  const chunk = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunk));
  }
  return btoa(binary);
}
