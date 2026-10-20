import { describe, expect, it } from 'vitest';
import { fetchTextWithRetry } from './retry.ts';

type Reply = { status: number; body?: string };

function fakeFetch(replies: Reply[]) {
  let calls = 0;
  const fn = (): Promise<{ ok: boolean; status: number; text: () => Promise<string> }> => {
    const reply = replies[Math.min(calls, replies.length - 1)] as Reply;
    calls += 1;
    return Promise.resolve({ ok: reply.status >= 200 && reply.status < 300, status: reply.status, text: () => Promise.resolve(reply.body ?? '') });
  };
  return { fn, calls: () => calls };
}

const noSleep = () => Promise.resolve();

describe('fetchTextWithRetry', () => {
  it('returns the body of a successful response', async () => {
    const { fn } = fakeFetch([{ status: 200, body: 'ok' }]);
    await expect(fetchTextWithRetry('u', { fetchFn: fn, sleep: noSleep })).resolves.toBe('ok');
  });

  it('retries on a 5xx and succeeds when the server recovers', async () => {
    const { fn, calls } = fakeFetch([{ status: 500 }, { status: 502 }, { status: 200, body: 'ok' }]);
    await expect(fetchTextWithRetry('u', { fetchFn: fn, sleep: noSleep })).resolves.toBe('ok');
    expect(calls()).toBe(3);
  });

  it('gives up after the allowed attempts and names the status', async () => {
    const { fn, calls } = fakeFetch([{ status: 500 }]);
    await expect(fetchTextWithRetry('u', { fetchFn: fn, sleep: noSleep, attempts: 3 })).rejects.toThrow(/500/);
    expect(calls()).toBe(3);
  });

  it('does not retry a 4xx, since repeating it cannot help', async () => {
    const { fn, calls } = fakeFetch([{ status: 404 }]);
    await expect(fetchTextWithRetry('u', { fetchFn: fn, sleep: noSleep })).rejects.toThrow(/404/);
    expect(calls()).toBe(1);
  });

  it('waits longer after each failure', async () => {
    const { fn } = fakeFetch([{ status: 500 }, { status: 500 }, { status: 200, body: 'ok' }]);
    const waits: number[] = [];
    await fetchTextWithRetry('u', { fetchFn: fn, sleep: (ms) => { waits.push(ms); return Promise.resolve(); }, baseDelayMs: 100 });
    expect(waits).toEqual([100, 200]);
  });
});
