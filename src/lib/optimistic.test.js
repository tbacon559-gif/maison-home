import { describe, it, expect, vi } from 'vitest';
import { withOptimistic } from './optimistic.js';

describe('withOptimistic', () => {
  it('applies the optimistic delta immediately and resolves on success', async () => {
    let state = { count: 0 };
    const setState = vi.fn((u) => { state = typeof u === 'function' ? u(state) : u; });
    const network = vi.fn(async () => 'ok');

    const result = await withOptimistic(
      setState,
      (prev) => ({ ...prev, count: prev.count + 1 }),
      network
    );

    expect(result).toBe('ok');
    expect(state).toEqual({ count: 1 });
    expect(setState).toHaveBeenCalledTimes(1);
    expect(network).toHaveBeenCalledTimes(1);
  });

  it('reverts to pre-state on network failure and rethrows', async () => {
    let state = { count: 0 };
    const setState = vi.fn((u) => { state = typeof u === 'function' ? u(state) : u; });
    const network = vi.fn(async () => { throw new Error('boom'); });

    await expect(withOptimistic(
      setState,
      (prev) => ({ ...prev, count: prev.count + 1 }),
      network
    )).rejects.toThrow('boom');

    // setState called twice: optimistic, then revert.
    expect(setState).toHaveBeenCalledTimes(2);
    expect(state).toEqual({ count: 0 });
  });
});
