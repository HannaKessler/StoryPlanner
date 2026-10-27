import { entitiesOf, formatValue, speakerName } from "../domain/format";
import { entityName } from "../domain/format";
import { graphName } from "../domain/graphOps";
import { beatLabel } from "../domain/labels";
import { entryNodes } from "../domain/graphOps";
import { availableActions, playLocation, suggestedNodes, type PlayAction } from "../domain/play";
import type { EntityKind, VariableValue } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { NumberField } from "./Panel";

const KIND_SHORT: Record<string, string> = {
  boolean: "bool",
  value: "value",
  character: "char",
  item: "item",
  location: "loc",
  inventory: "items",
};

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
  const choices = choosing ? suggestedNodes(choosing) : [];
  const entries = new Set(choosing ? entryNodes(choosing).map((node) => node.id) : []);
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
            <h2>{graphName(choosing, graphs, project)}</h2>
            {choices.length > 0 && (
              <div className="sp-play-group">
                {choices.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    className={entries.has(node.id) ? "sp-play-action is-enter" : "sp-play-action"}
                    onClick={() => beginPlay(node.id)}
                  >
                    <span className="sp-play-action-top">
                      <strong>{beatLabel(node, project)}</strong>
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
            <h2>{beatLabel(location.node, project)}</h2>
            {location.node.summary.trim() && <p className="sp-script-summary">{location.node.summary}</p>}
            {location.node.sceneNotes.trim() && <p className="sp-script-note">{location.node.sceneNotes}</p>}
            {location.node.lines.length > 0 && (
              <div className="sp-script-lines">
                {location.node.lines.map((line) => (
                  <div key={line.id} className="sp-script-line">
                    <p className="sp-script-speaker">{speakerName(project, line.speakerId)}</p>
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
            const changed = JSON.stringify(value) !== JSON.stringify(variable.defaultValue);
            const entityKind: EntityKind | null =
              variable.kind === "character" || variable.kind === "item" || variable.kind === "location"
                ? variable.kind
                : variable.kind === "inventory"
                  ? "item"
                  : null;
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
                    <NumberField
                      className="sp-cell sp-cell-value"
                      label={variable.name}
                      value={typeof value === "number" ? value : 0}
                      onCommit={(next) => updatePlayValue(variable.id, next)}
                    />
                  ) : variable.kind === "inventory" ? (
                    <InventoryValue
                      name={variable.name}
                      ids={Array.isArray(value) ? value : []}
                      choices={project.items}
                      onChange={(next) => updatePlayValue(variable.id, next)}
                    />
                  ) : entityKind ? (
                    <select
                      className="sp-cell sp-cell-value"
                      aria-label={variable.name}
                      value={typeof value === "string" ? value : ""}
                      onChange={(event) => updatePlayValue(variable.id, event.target.value || null)}
                    >
                      <option value="">unset</option>
                      {entitiesOf(project, entityKind).map((entity) => (
                        <option key={entity.id} value={entity.id}>
                          {entityName(project, entity.id)}
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
    </button>
  );
}

function InventoryValue({
  name,
  ids,
  choices,
  onChange,
}: {
  name: string;
  ids: string[];
  choices: Array<{ id: string; name: string }>;
  onChange: (next: VariableValue) => void;
}) {
  const project = useProjectStore((state) => state.project);
  return (
    <span className="sp-inv">
      {ids.map((id) => (
        <button key={id} type="button" className="sp-chip-btn is-on" onClick={() => onChange(ids.filter((item) => item !== id))}>
          {project ? entityName(project, id) : id} ×
        </button>
      ))}
      <select
        className="sp-cell sp-cell-value"
        aria-label={name}
        value=""
        onChange={(event) => {
          if (event.target.value && !ids.includes(event.target.value)) onChange([...ids, event.target.value]);
        }}
      >
        <option value="">+</option>
        {choices.filter((item) => !ids.includes(item.id)).map((item) => (
          <option key={item.id} value={item.id}>
            {project ? entityName(project, item.id) : item.name}
          </option>
        ))}
      </select>
    </span>
  );
}
