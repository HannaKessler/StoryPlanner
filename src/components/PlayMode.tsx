import { formatValue, speakerName } from "../domain/format";
import { startNodes } from "../domain/graphOps";
import { availableActions, playLocation, type PlayAction } from "../domain/play";
import { useProjectStore } from "../store/projectStore";

const KIND_SHORT: Record<string, string> = { boolean: "bool", value: "value", tag: "tag" };

export function PlayMode() {
  const project = useProjectStore((state) => state.project);
  const graphs = useProjectStore((state) => state.graphs);
  const play = useProjectStore((state) => state.play);
  const performPlay = useProjectStore((state) => state.performPlay);
  const updatePlayValue = useProjectStore((state) => state.updatePlayValue);
  const restartPlay = useProjectStore((state) => state.restartPlay);
  const beginPlay = useProjectStore((state) => state.beginPlay);
  const cancelStartChoice = useProjectStore((state) => state.cancelStartChoice);
  if (!project || !play) return null;
  const choosing = play.choosingGraphId ? graphs[play.choosingGraphId] : null;
  const starts = choosing ? startNodes(choosing) : [];
  const location = play.choosingGraphId ? null : playLocation(play, graphs);
  const actions = availableActions(play, project, graphs);
  const transitions = actions.filter((action) => action.kind === "transition");
  const enter = actions.find((action) => action.kind === "enter");
  const back = actions.find((action) => action.kind === "return");
  const open = transitions.filter((action) => action.enabled).length;

  return (
    <div className="sp-play">
      <div className="sp-play-stage">
        <div className="sp-play-bar">
          <p className="sp-play-log" title="Beats entered so far">
            {play.log.join(" → ")}
          </p>
          <span className="sp-grow" />
          <button type="button" className="sp-chip-btn" onClick={restartPlay}>
            Restart
          </button>
        </div>
        {choosing && (
          <article className="sp-script">
            <h2>{choosing.name || "Untitled"}</h2>
            {starts.length === 0 ? (
              <p className="sp-empty">This graph has no start.</p>
            ) : (
              <div className="sp-play-group">
                <h3>Start</h3>
                {starts.map((node) => (
                  <button key={node.id} type="button" className="sp-play-action is-enter" onClick={() => beginPlay(node.id)}>
                    <span className="sp-play-action-top">
                      <strong>{node.title || "Untitled"}</strong>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {play.frames.length > 0 && (
              <button type="button" className="sp-chip-btn" onClick={cancelStartChoice}>
                Back
              </button>
            )}
          </article>
        )}
        {!choosing && !location && <p className="sp-empty">Beat missing.</p>}
        {location && (
          <article className="sp-script">
            <h2>{location.node.title || "Untitled"}</h2>
            {location.node.summary.trim() && <p className="sp-script-summary">{location.node.summary}</p>}
            {location.node.sceneNotes.trim() && <p className="sp-script-note">{location.node.sceneNotes}</p>}
            {location.node.lines.length > 0 && (
              <div className="sp-script-lines">
                {location.node.lines.map((line) => (
                  <div key={line.id} className="sp-script-line">
                    <p className="sp-script-speaker">{speakerName(project, line.speakerTagId)}</p>
                    <div>
                      {line.direction.trim() && <p className="sp-script-direction">({line.direction})</p>}
                      <p className="sp-script-text">{line.text || "…"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {enter && <ActionButton action={enter} onPick={performPlay} />}
            {transitions.length > 0 ? (
              <div className="sp-play-group">
                <h3>
                  Transitions <span className="sp-faint">{open}/{transitions.length}</span>
                </h3>
                {transitions.map((action) => (
                  <ActionButton key={action.id} action={action} onPick={performPlay} />
                ))}
              </div>
            ) : (
              !back && <h3 className="sp-play-end">End</h3>
            )}
            {back && <ActionButton action={back} onPick={performPlay} />}
          </article>
        )}
      </div>
      <aside className="sp-play-vars sp-panel">
        <header className="sp-sec-head">
          <span className="sp-sec-title" title="Changed values are highlighted. Edit one to try another branch.">
            Live variables
          </span>
          <span className="sp-sec-count">{project.variables.length}</span>
        </header>
        <ul className="sp-var-list">
          {project.variables.map((variable) => {
            const value = play.values[variable.id];
            const changed = value !== variable.defaultValue;
            const category = project.tagCategories.find((item) => item.id === variable.tagCategoryId);
            return (
              <li key={variable.id} className={changed ? "sp-var is-changed" : "sp-var"}>
                <div className="sp-var-main">
                  <span className={`sp-kind sp-kind-${variable.kind}`}>{KIND_SHORT[variable.kind] ?? variable.kind}</span>
                  <span className="sp-var-name" title={`default ${formatValue(project, variable, variable.defaultValue)}`}>
                    {variable.name}
                  </span>
                  {variable.kind === "boolean" ? (
                    <select className="sp-cell sp-cell-value" aria-label={variable.name} value={value === true ? "true" : "false"} onChange={(event) => updatePlayValue(variable.id, event.target.value === "true")}>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : variable.kind === "value" ? (
                    <input
                      className="sp-cell sp-cell-value"
                      type="number"
                      aria-label={variable.name}
                      value={typeof value === "number" ? value : 0}
                      onChange={(event) => updatePlayValue(variable.id, Number(event.target.value))}
                    />
                  ) : variable.kind === "tag" ? (
                    <select
                      className="sp-cell sp-cell-value"
                      aria-label={variable.name}
                      value={typeof value === "string" ? value : ""}
                      onChange={(event) => updatePlayValue(variable.id, event.target.value || null)}
                    >
                      <option value="">unset</option>
                      {category?.tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="sp-cell sp-cell-value">{value == null ? "unset" : String(value)}</span>
                  )}
                </div>
                {changed && <p className="sp-var-default">was {formatValue(project, variable, variable.defaultValue)}</p>}
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}

function ActionButton({ action, onPick }: { action: PlayAction; onPick: (action: PlayAction) => void }) {
  const className = `sp-play-action is-${action.kind}${action.enabled ? "" : " is-off"}`;
  return (
    <button type="button" className={className} disabled={!action.enabled} onClick={() => onPick(action)}>
      <span className="sp-play-action-top">
        <strong>{action.label}</strong>
        {action.label !== action.target && <span className="sp-faint">→ {action.target}</span>}
        {!action.enabled && <span className="sp-blocked">blocked</span>}
      </span>
      {action.condition && <small>if {action.condition}</small>}
      {action.effects && <small className="sp-play-fx">then {action.effects}</small>}
    </button>
  );
}
