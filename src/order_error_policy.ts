import { createHash } from "node:crypto";
import { z } from "zod";
import type { CapturePayload } from "./infrai_errors_client.js";

export const orderErrorSchema = z.object({
  orderId: z.string().min(1).max(100),
  stage: z.enum(["checkout", "fulfillment", "receipt", "customer_order_update"]),
  errorType: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  occurredAt: z.string().datetime(),
  attemptId: z.string().uuid(),
  details: z.record(z.string(), z.unknown()).default({}),
});

export type OrderError = z.infer<typeof orderErrorSchema>;

const privateKeys = new Set(["email", "phone", "address", "cardNumber", "customerName"]);

function sanitizedDetails(details: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(details).filter(([key]) => !privateKeys.has(key)));
}

export function captureDecision(input: OrderError): { payload: CapturePayload; idempotencyKey: string } {
  const fingerprint = ["commerce-order", input.stage, input.errorType];
  const idempotencyKey = createHash("sha256").update(`order-error:${input.attemptId}`).digest("hex");
  return {
    idempotencyKey,
    payload: {
      title: `${input.stage}: ${input.errorType}`,
      message: input.message,
      level: "error",
      fingerprint,
      exception: `${input.errorType}: ${input.message}`,
      context: {
        orderId: input.orderId,
        stage: input.stage,
        occurredAt: input.occurredAt,
        details: sanitizedDetails(input.details),
      },
    },
  };
}
