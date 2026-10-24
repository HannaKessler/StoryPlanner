import { formatValue, speakerName } from "../domain/format";
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
  if (!project || !play) return null;
  const location = playLocation(play, graphs);
  const actions = availableActions(play, project, graphs);
  const transitions = actions.filter((action) => action.kind === "transition");
  const enter = actions.find((action) => action.kind === "enter");
  const back = actions.find((action) => action.kind === "return");
  const open = transitions.filter((action) => action.enabled).length;
  const depth = play.frames.map((frame) => graphs[frame.graphId]?.name || "Untitled").join(" / ");

  return (
    <div className="sp-play">
      <div className="sp-play-stage">
        <div className="sp-play-bar">
          <span className="sp-faint">{depth}</span>
          <span className="sp-grow" />
          <button type="button" className="sp-chip-btn" onClick={restartPlay}>
            Restart
          </button>
        </div>
        <p className="sp-play-log" title="Beats entered so far">
          {play.log.join(" → ")}
        </p>
        {!location && <p className="sp-empty">This beat is gone. Restart the play-through.</p>}
        {location && (
          <article className="sp-script">
            <p className="sp-kicker">{location.graph.name}</p>
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
            <div className="sp-play-group">
              <h3>
                Transitions <span className="sp-faint">{open} of {transitions.length} open</span>
              </h3>
              {transitions.length === 0 && (
                <p className="sp-hint">{location.node.type === "end" ? "End of this branch." : "No transitions leave this beat."}</p>
              )}
              {transitions.map((action) => (
                <ActionButton key={action.id} action={action} onPick={performPlay} />
              ))}
            </div>
            {back && <ActionButton action={back} onPick={performPlay} />}
          </article>
        )}
      </div>
      <aside className="sp-play-vars sp-panel">
        <header className="sp-sec-head">
          <span className="sp-sec-title">Live variables</span>
          <span className="sp-sec-count">{project.variables.length}</span>
        </header>
        <p className="sp-hint">Changed values are highlighted. Edit one to open another branch.</p>
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
        {action.kind === "transition" && action.label !== action.target && <span className="sp-faint">→ {action.target}</span>}
        {action.kind !== "transition" && <span className="sp-faint">{action.kind === "enter" ? `into ${action.target}` : `to ${action.target}`}</span>}
        {!action.enabled && <span className="sp-blocked">blocked</span>}
      </span>
      {action.condition && <small>if {action.condition}</small>}
      {action.effects && <small className="sp-play-fx">then {action.effects}</small>}
    </button>
  );
}
