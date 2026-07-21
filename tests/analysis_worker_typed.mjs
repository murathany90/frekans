import assert from "node:assert/strict";
import { typed } from "../assets/analysis-worker.mjs";

const source = new Float64Array([1, 2, 3, 4]);
const view = source.subarray(1, 3);
const converted = typed(view);

assert.deepEqual(Array.from(converted), [2, 3], "typed() must preserve typed-array byteOffset and length.");

console.log("analysis_worker_typed ok");
