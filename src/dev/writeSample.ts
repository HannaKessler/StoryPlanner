import { mkdirSync, writeFileSync } from "node:fs";
import { buildSample } from "../domain/sample";
import { stringifyDoc } from "../domain/schema";

const { project, graphs } = buildSample();
mkdirSync("sample-project/graphs", { recursive: true });
writeFileSync("sample-project/project.json", stringifyDoc(project));
for (const graph of Object.values(graphs)) {
  writeFileSync(`sample-project/graphs/${graph.id}.json`, stringifyDoc(graph));
}
console.log(`Wrote sample project with ${Object.keys(graphs).length} graphs.`);
