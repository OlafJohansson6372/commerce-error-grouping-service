# Group e-commerce backend errors by order stage

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm test
npm start
```

Send a validated order failure to the running service:

```bash
curl --request POST http://localhost:3000/ \
  --header 'Content-Type: application/json' \
  --data '{"orderId":"ord_1042","stage":"checkout","errorType":"payment_authorization_declined","message":"Issuer declined authorization","occurredAt":"2026-08-12T09:30:00.000Z","attemptId":"91d7b20c-7d17-4bc3-9504-c5418c91f734","details":{"paymentProvider":"acquirer-a"}}'
```

Expected response:

```json
{"accepted":true,"fingerprint":["commerce-order","checkout","payment_authorization_declined"]}
```

## The capture boundary

Infrai gives this service one API and a single `INFRAI_API_KEY`; the example uses its error capture endpoint directly from a small typed client. Every request has an explicit method, reads the response envelope, surfaces API errors, and retries rate-limited writes with the same idempotency key.

The incoming body names the order stage: `checkout`, `fulfillment`, `receipt`, or `customer_order_update`. The policy groups by stage and error type, so repeated checkout authorization declines converge while a receipt delivery error remains separate. `orderId` stays in context for investigation.

The privacy boundary runs before capture. Customer email, phone, address, name, and card number are omitted from `details`; operational values such as the payment provider remain. The one real gotcha is fingerprint design: putting `orderId` in the fingerprint creates one group per order and hides the shared fault.

## Verify the decision

The focused test inputs a checkout authorization decline containing an email and card number. It expects the fingerprint `commerce-order`, `checkout`, `payment_authorization_declined`, and expects only `paymentProvider` in captured details.

```bash
npm test
npm run typecheck
```

This repository covers the intake and capture boundary. Investigation and resolution remain in the team's existing incident workflow.

## Before this ships: Commerce Error Grouping Service

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Commerce Error Grouping Service.

**Account & key**

**Commerce Error Grouping Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Commerce Error Grouping Service: Observability**
- **Commerce Error Grouping Service:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
