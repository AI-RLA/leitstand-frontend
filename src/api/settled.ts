/**
 * Whether a query has its answer or cannot get one now, so a page that waits for it may go on.
 *
 * A query stays pending while it is paused for lack of network, so waiting on `isPending` alone
 * would wait until the network returns.
 */
export function isSettled(query: {
  isPending: boolean;
  fetchStatus: string;
}): boolean {
  return !query.isPending || query.fetchStatus === "paused";
}
