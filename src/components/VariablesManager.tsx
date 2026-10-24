import { kindLabel } from "../domain/labels";
import { KNOWN_VARIABLE_KINDS } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { Field } from "./Modal";

export function VariablesManager() {
  const project = useProjectStore((state) => state.project);
  const addVariable = useProjectStore((state) => state.addVariable);
  const updateVariable = useProjectStore((state) => state.updateVariable);
  const deleteVariable = useProjectStore((state) => state.deleteVariable);
  if (!project) return null;

  return (
    <section className="sp-page">
      <header className="sp-page-head">
        <div>
          <p className="sp-kicker">Project</p>
          <h2>Variables</h2>
          <p className="sp-muted">These are global. Every graph can read them and every beat or choice can change them.</p>
        </div>
        <div className="sp-inline">
          {KNOWN_VARIABLE_KINDS.map((kind) => (
            <button key={kind} type="button" className="sp-btn sp-btn-small" onClick={() => addVariable(kind)}>
              + {kindLabel(kind)}
            </button>
          ))}
        </div>
      </header>
      {project.variables.length === 0 && <p className="sp-empty">No variables yet. Add a boolean, a number, or a tag.</p>}
      <div className="sp-card-list">
        {project.variables.map((variable) => (
          <article key={variable.id} className="sp-card">
            <div className="sp-card-top">
              <span className="sp-pill">{kindLabel(variable.kind)}</span>
              <button type="button" className="sp-btn sp-btn-small is-danger" onClick={() => deleteVariable(variable.id)}>
                Delete
              </button>
            </div>
            <Field label="Name">
              <input className="sp-input" value={variable.name} onChange={(event) => updateVariable(variable.id, { name: event.target.value })} />
            </Field>
            <Field label="Description">
              <input
                className="sp-input"
                value={variable.description}
                onChange={(event) => updateVariable(variable.id, { description: event.target.value })}
              />
            </Field>
            {variable.kind === "boolean" && (
              <Field label="Default">
                <select
                  className="sp-select"
                  value={variable.defaultValue === true ? "true" : "false"}
                  onChange={(event) => updateVariable(variable.id, { defaultValue: event.target.value === "true" })}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </Field>
            )}
            {variable.kind === "value" && (
              <Field label="Default">
                <input
                  className="sp-input"
                  type="number"
                  value={typeof variable.defaultValue === "number" ? variable.defaultValue : 0}
                  onChange={(event) => updateVariable(variable.id, { defaultValue: Number(event.target.value) })}
                />
              </Field>
            )}
            {variable.kind === "tag" && (
              <>
                <Field label="Tag category">
                  <select
                    className="sp-select"
                    value={variable.tagCategoryId ?? ""}
                    onChange={(event) => updateVariable(variable.id, { tagCategoryId: event.target.value || null, defaultValue: null })}
                  >
                    <option value="">None</option>
                    {project.tagCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Default tag">
                  <select
                    className="sp-select"
                    value={typeof variable.defaultValue === "string" ? variable.defaultValue : ""}
                    onChange={(event) => updateVariable(variable.id, { defaultValue: event.target.value || null })}
                  >
                    <option value="">Unset</option>
                    {project.tagCategories
                      .find((category) => category.id === variable.tagCategoryId)
                      ?.tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                  </select>
                </Field>
              </>
            )}
            {variable.kind !== "boolean" && variable.kind !== "value" && variable.kind !== "tag" && (
              <p className="sp-muted">This kind was stored for a newer editor. It is kept as-is.</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
