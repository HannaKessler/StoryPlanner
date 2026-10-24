import { speakerName } from "../domain/format";
import { kindLabel } from "../domain/labels";
import { availableActions, playLocation, type PlayAction } from "../domain/play";
import { useProjectStore } from "../store/projectStore";

export function PlayMode() {
  const project = useProjectStore((state) => state.project);
  const graphs = useProjectStore((state) => state.graphs);
  const play = useProjectStore((state) => state.play);
  const performPlay = useProjectStore((state) => state.performPlay);
  const updatePlayValue = useProjectStore((state) => state.updatePlayValue);
  const restartPlay = useProjectStore((state) => state.restartPlay);
  if (!project || !play) return null;
  const location = playLocation(play, graphs);
  const actions = availableActions(play, project, graphs);
  const groups: Array<{ title: string; kind: PlayAction["kind"] }> = [
    { title: "Detail", kind: "enter" },
    { title: "Choices", kind: "choice" },
    { title: "Exits", kind: "edge" },
    { title: "Leave", kind: "return" },
  ];

  return (
    <div className="sp-play">
      <div className="sp-play-stage">
        <p className="sp-play-log">{play.log.join(" → ")}</p>
        {!location && <p className="sp-empty">This beat is gone. Restart the play-through.</p>}
        {location && (
          <article className="sp-script">
            {location.graph.sceneNotes.trim() && <p className="sp-script-note">{location.graph.sceneNotes}</p>}
            <p className="sp-kicker">{location.graph.name}</p>
            <h2>{location.node.title || "Untitled"}</h2>
            {location.node.summary.trim() && <p className="sp-script-summary">{location.node.summary}</p>}
            {location.node.sceneNotes.trim() && <p className="sp-script-note">{location.node.sceneNotes}</p>}
            <div className="sp-script-lines">
              {location.node.lines.map((line) => (
                <div key={line.id}>
                  <p className="sp-script-speaker">{speakerName(project, line.speakerTagId)}</p>
                  {line.direction.trim() && <p className="sp-script-direction">({line.direction})</p>}
                  <p className="sp-script-text">{line.text || "…"}</p>
                </div>
              ))}
            </div>
            {location.node.type === "end" && <p className="sp-muted">End of this branch.</p>}
            {groups.map((group) => {
              const items = actions.filter((action) => action.kind === group.kind);
              if (items.length === 0) return null;
              return (
                <div key={group.kind} className="sp-play-group">
                  <h3>{group.title}</h3>
                  {items.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className={action.enabled ? "sp-play-action" : "sp-play-action is-off"}
                      disabled={!action.enabled}
                      onClick={() => performPlay(action)}
                    >
                      <strong>{action.label}</strong>
                      {action.enabled && action.detail && action.detail !== "Always" && <small>{action.detail}</small>}
                      {!action.enabled && action.reason && <small>{action.reason}</small>}
                    </button>
                  ))}
                </div>
              );
            })}
          </article>
        )}
      </div>
      <aside className="sp-play-vars">
        <header>
          <h2>Variables</h2>
          <button type="button" className="sp-btn sp-btn-small" onClick={restartPlay}>
            Restart
          </button>
        </header>
        <p className="sp-muted">Live values for this play-through. Change one to try another branch.</p>
        <ul>
          {project.variables.map((variable) => {
            const value = play.values[variable.id];
            const changed = value !== variable.defaultValue;
            return (
              <li key={variable.id} className={changed ? "is-changed" : ""}>
                <div>
                  <strong>{variable.name}</strong>
                  <small>
                    {kindLabel(variable.kind)} · default {formatDefault(variable.defaultValue, variable.kind, project.tagCategories)}
                  </small>
                </div>
                {variable.kind === "boolean" ? (
                  <button type="button" className="sp-btn sp-btn-small" onClick={() => updatePlayValue(variable.id, value !== true)}>
                    {value === true ? "true" : "false"}
                  </button>
                ) : variable.kind === "value" ? (
                  <input
                    className="sp-input"
                    type="number"
                    value={typeof value === "number" ? value : 0}
                    onChange={(event) => updatePlayValue(variable.id, Number(event.target.value))}
                  />
                ) : variable.kind === "tag" ? (
                  <select
                    className="sp-select"
                    value={typeof value === "string" ? value : ""}
                    onChange={(event) => updatePlayValue(variable.id, event.target.value || null)}
                  >
                    <option value="">unset</option>
                    {project.tagCategories
                      .find((category) => category.id === variable.tagCategoryId)
                      ?.tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                  </select>
                ) : (
                  <span>{value == null ? "unset" : String(value)}</span>
                )}
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}

function formatDefault(
  value: boolean | number | string | null,
  kind: string,
  categories: { tags: { id: string; name: string }[] }[],
): string {
  if (kind === "tag") {
    if (typeof value !== "string") return "unset";
    for (const category of categories) {
      const tag = category.tags.find((item) => item.id === value);
      if (tag) return tag.name;
    }
    return "missing tag";
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value == null) return "unset";
  return String(value);
}
