import { createServer } from "node:http";
import { InfraiErrorsClient } from "./infrai_errors_client.js";
import { captureDecision, orderErrorSchema } from "./order_error_policy.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const client = new InfraiErrorsClient(apiKey);
const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST" || request.url !== "/") {
    response.writeHead(404).end(JSON.stringify({ accepted: false }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = orderErrorSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const decision = captureDecision(input);
    await client.capture(decision.payload, decision.idempotencyKey);
    response.writeHead(202).end(JSON.stringify({ accepted: true, fingerprint: decision.payload.fingerprint }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    response.writeHead(400).end(JSON.stringify({ accepted: false, message }));
  }
}).listen(port, () => console.log(`Order error intake listening on http://localhost:${port}`));
