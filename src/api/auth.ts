/**
 * The credential this browser presents to the backend.
 *
 * A gate, not an identity: the token ships inside the bundle, so anyone who can load the app can
 * read it. It keeps an unauthenticated client off the API on a shared network, nothing more.
 * Leave it unset and the backend stays open, which is the dev default.
 */
const TOKEN = import.meta.env.VITE_API_TOKEN ?? "";

/** Authorization header for REST and SSE, or nothing when no token is configured. */
export function authHeaders(): Record<string, string> {
  return TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
}

/**
 * Subprotocols for the WebSocket handshake.
 *
 * A browser cannot set headers on a WebSocket, so the token rides the one field it can control;
 * the backend reads it from here and echoes back only `leitstand.v1`.
 */
export function wsSubprotocols(): string[] {
  return TOKEN ? ["leitstand.v1", `leitstand.bearer.${TOKEN}`] : [];
}
