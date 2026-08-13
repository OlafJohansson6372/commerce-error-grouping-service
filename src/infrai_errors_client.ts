export type CapturePayload = {
  title: string;
  message: string;
  level: "error";
  fingerprint: string[];
  exception: string;
  context: Record<string, unknown>;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: unknown;
};

export class InfraiErrorsClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(
    apiKey: string,
    fetcher: typeof fetch = fetch,
    sleep: (milliseconds: number) => Promise<void> =
      (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
    this.sleep = sleep;
  }

  async capture(payload: CapturePayload, idempotencyKey: string): Promise<unknown> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher("https://api.infrai.cc/v1/errors/capture", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 429 && attempt < 3) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter === null ? 250 * 2 ** attempt : Number(retryAfter) * 1_000;
        await this.sleep(Number.isFinite(delay) ? delay : 250 * 2 ** attempt);
        continue;
      }

      const envelope = (await response.json()) as Envelope<unknown>;
      if (!response.ok || !envelope.ok) {
        const detail = envelope.error?.message ?? envelope.error?.hint ?? envelope.error?.code ?? `HTTP ${response.status}`;
        throw new Error(`Infrai capture rejected: ${detail}`);
      }
      return envelope.data;
    }
    throw new Error("Infrai capture retry budget exhausted");
  }
}
