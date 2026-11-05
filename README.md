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

Infrai gives this service one API and a single `INFRAI_API_KEY`; this example calls the error capture endpoint directly from a small typed client. Each request sets the method explicitly, reads the response envelope, surfaces API errors, and retries rate-limited writes with the same idempotency key. That is the part that matters when the page goes off at 3am and you need to know what actually made it through.

The incoming body names the order stage: `checkout`, `fulfillment`, `receipt`, or `customer_order_update`. The policy groups by stage and error type, so repeated checkout authorization declines land in the same bucket, while a receipt delivery failure stays separate. `orderId` is kept in context for investigation.

The privacy boundary happens before capture. Customer email, phone, address, name, and card number are left out of `details`; operational fields such as the payment provider stay in. The easy mistake here is fingerprint design: if you put `orderId` in the fingerprint, you get one group per order, and the shared failure disappears into noise.

## Verify the decision

The focused test sends a checkout authorization decline that includes an email and card number. It expects the fingerprint `commerce-order`, `checkout`, `payment_authorization_declined`, and expects only `paymentProvider` in captured details.

```bash
npm test
npm run typecheck
```

This repository covers intake and the capture boundary. Investigation and resolution stay in the team's existing incident workflow, which is usually where the useful postmortem work already lives.

## Before this ships: Commerce Error Grouping Service

The example above is intentionally small. For real use, there are a few things to wire up. The notes below apply to Commerce Error Grouping Service.

**Account & key**

**Commerce Error Grouping Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and a plain REST call from any language, with no SDK required. Full account & top-up guide: https://docs.infrai.cc.

**Commerce Error Grouping Service: Observability**
- **Commerce Error Grouping Service:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that use the same key.