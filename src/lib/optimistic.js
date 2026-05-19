// ─── Optimistic-update helper ────────────────────────────────────
// Capture pre-state via the functional setState pattern, apply the
// optimistic delta, await the network call. On failure, revert and
// rethrow so the caller can surface an error to the user.

export async function withOptimistic(setState, delta, networkCall) {
  let pre;
  setState((prev) => {
    pre = prev;
    return delta(prev);
  });
  try {
    return await networkCall();
  } catch (err) {
    setState(pre);
    throw err;
  }
}
