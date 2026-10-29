
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, setToken } from './api';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('sends the bearer token on authenticated calls', async () => {
    setToken('tok123');
    fetch.mockResolvedValue(reply(200, { ok: true }));

    await api('/me');

    const [url, options] = fetch.mock.calls[0];
    expect(url).toMatch(/\/me$/);
    expect(options.headers.Authorization).toBe('Bearer tok123');
  });

  it('does not send a token when auth is false', async () => {
    setToken('tok123');
    fetch.mockResolvedValue(reply(200, {}));

    await api('/auth/login', { method: 'POST', body: { a: 1 }, auth: false });

    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('surfaces a string error from the server', async () => {
    fetch.mockResolvedValue(reply(401, { detail: 'Incorrect email or password' }));

    await expect(api('/auth/login', { method: 'POST', auth: false })).rejects.toThrow(
      'Incorrect email or password'
    );
  });

  it('surfaces the first validation message from a 422', async () => {
    fetch.mockResolvedValue(reply(422, { detail: [{ msg: 'Field required' }] }));

    await expect(api('/me/expenses/', { method: 'POST' })).rejects.toThrow('Field required');
  });

  it('returns null for a 204 response', async () => {
    fetch.mockResolvedValue(reply(204, null));

    expect(await api('/me/expenses/1', { method: 'DELETE' })).toBeNull();
  });
});
