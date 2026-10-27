import { useEffect, useState } from "react";
import { readFileBytes } from "../desktop/tauri";
import { entitiesOf } from "../domain/format";
import { joinPath } from "../domain/paths";
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

  return (
    <div className="sp-library">
      <div
        className="sp-library-list"
        onContextMenu={menuHandler(() => [{ label: `Add ${kind}`, onSelect: () => setSelected(addEntity(kind)) }])}
      >
        <header className="sp-sec-head">
          <span className="sp-sec-title">{TITLES[kind]}</span>
          <span className="sp-sec-count">{entities.length}</span>
        </header>
        <ul className="sp-beats">
          {entities.map((entity) => (
            <li
              key={entity.id}
              className={current?.id === entity.id ? "is-active" : ""}
              onContextMenu={menuHandler(() => [
                { label: `Add ${kind}`, onSelect: () => setSelected(addEntity(kind)) },
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
                <span className="sp-beat-title">{entity.name || "Untitled"}</span>
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
  const updateEntity = useProjectStore((state) => state.updateEntity);
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
        className="sp-head-input"
        aria-label="Name"
        data-rename={entity.id}
        value={entity.name}
        onChange={(event) => updateEntity(kind, entity.id, { name: event.target.value })}
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
            <figure key={path}>
              <EntityImage path={path} />
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
                label="Remove field"
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

function EntityImage({ path }: { path: string }) {
  const projectPath = useProjectStore((state) => state.projectPath);
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!projectPath) return;
    let cancelled = false;
    void readFileBytes(joinPath(projectPath, path))
      .then((bytes) => {
        if (cancelled) return;
        setSrc(`data:${mime(path)};base64,${toBase64(bytes)}`);
      })
      .catch(() => {
        if (!cancelled) setSrc("");
      });
    return () => {
      cancelled = true;
    };
  }, [path, projectPath]);
  if (!src) return <span className="sp-gallery-missing" />;
  return <img src={src} alt="" />;
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
