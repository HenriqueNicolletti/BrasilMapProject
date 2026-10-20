interface FetchLikeResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

export interface RetryOptions {
  fetchFn?: (url: string) => Promise<FetchLikeResponse>;
  sleep?: (ms: number) => Promise<void>;
  attempts?: number;
  baseDelayMs?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** GET as text. Retries 5xx and network errors with growing waits; a 4xx is final. */
export async function fetchTextWithRetry(url: string, options: RetryOptions = {}): Promise<string> {
  const fetchFn = options.fetchFn ?? ((target: string) => fetch(target));
  const sleep = options.sleep ?? defaultSleep;
  const attempts = options.attempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 1500;

  let lastError = new Error(`No attempt was made for ${url}`);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchFn(url);
      if (response.ok) return await response.text();
      lastError = new Error(`HTTP ${String(response.status)} for ${url}`);
      if (response.status < 500) throw lastError;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (/HTTP 4\d\d/.test(lastError.message)) throw lastError;
    }
    if (attempt < attempts) await sleep(baseDelayMs * 2 ** (attempt - 1));
  }
  throw lastError;
}
