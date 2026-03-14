import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;

const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

/**
 * Proxy-aware fetch. Uses the HTTPS_PROXY/HTTP_PROXY env vars if set,
 * otherwise falls back to regular fetch.
 */
export function pfetch(url: string | URL, init?: RequestInit): Promise<Response> {
  if (dispatcher) {
    return undiciFetch(url, { ...init, dispatcher } as Parameters<typeof undiciFetch>[1]) as unknown as Promise<Response>;
  }
  return fetch(url, init);
}
