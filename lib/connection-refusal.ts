/**
 * Why Taskforce.sh refused this connector, and what to do about it.
 *
 * The server refuses the handshake with an HTTP status (connectors that send
 * their connection name), or closes the socket with 4000 + status (when it
 * learns the connection after connecting):
 *
 * - 401: the token is unknown, revoked or expired. Retrying can't help.
 * - 402: there is no plan with connections for the account or organization.
 * - 403: its connection quota is used up.
 *
 * For 402 and 403 the connector keeps retrying, more and more slowly, so that
 * subscribing or freeing a connection fixes it without a restart.
 */
export interface Refusal {
  status: number;
  action: "stop" | "backoff" | "retry";
  message: string;
}

const FALLBACK_MESSAGES: { [status: number]: string } = {
  401: "Authorization failed: the token is invalid, revoked or expired. Personal tokens are on your account page, organization tokens on the organization's Tokens tab.",
  402: "There is no plan with connections for this account or organization: subscribe at https://taskforce.sh",
  403: "The connection quota is used up: remove connections or upgrade the plan at https://taskforce.sh",
};

export const MIN_BACKOFF = 60 * 1000;
export const MAX_BACKOFF = 10 * 60 * 1000;

export function refusalForStatus(status: number, message?: string): Refusal {
  const text = (message || "").trim() || FALLBACK_MESSAGES[status];
  switch (status) {
    case 401:
      return { status, action: "stop", message: text };
    case 402:
    case 403:
      return { status, action: "backoff", message: text };
    default:
      return {
        status,
        action: "retry",
        message: text || `Unexpected server response: ${status}`,
      };
  }
}

/**
 * The refusal behind a close code, if it is one (4401, 4402, 4403).
 */
export function refusalForCloseCode(code: number, reason?: string): Refusal | null {
  if (code === 4401 || code === 4402 || code === 4403) {
    return refusalForStatus(code - 4000, reason);
  }
  return null;
}

/**
 * The next wait before retrying after a 402 or 403: one minute, doubling up
 * to ten.
 */
export function nextBackoff(previous: number) {
  return Math.min(Math.max(previous * 2, MIN_BACKOFF), MAX_BACKOFF);
}
