import { parentPort } from "node:worker_threads";

if (!parentPort) {
  throw new Error("Worker must be run as a worker thread");
}

const end = Date.now() + 30000;

while (Date.now() < end) {
  Math.sqrt(Math.random() * Math.random());
}

parentPort.postMessage({
  message: "load completed",
});