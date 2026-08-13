import assert from "node:assert/strict";
import test from "node:test";
import { captureDecision, orderErrorSchema } from "../src/order_error_policy.js";

test("groups the same checkout failure while excluding customer data", () => {
  const input = orderErrorSchema.parse({
    orderId: "ord_1042",
    stage: "checkout",
    errorType: "payment_authorization_declined",
    message: "Issuer declined authorization",
    occurredAt: "2026-08-12T09:30:00.000Z",
    attemptId: "91d7b20c-7d17-4bc3-9504-c5418c91f734",
    details: { paymentProvider: "acquirer-a", email: "patient@example.test", cardNumber: "4111111111111111" },
  });

  const decision = captureDecision(input);
  assert.deepEqual(decision.payload.fingerprint, ["commerce-order", "checkout", "payment_authorization_declined"]);
  assert.deepEqual(decision.payload.context.details, { paymentProvider: "acquirer-a" });
  assert.equal(decision.idempotencyKey.length, 64);
});

test("rejects an unknown order stage at the request boundary", () => {
  assert.equal(orderErrorSchema.safeParse({ stage: "refund" }).success, false);
});
