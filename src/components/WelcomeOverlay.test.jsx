// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import WelcomeOverlay from './WelcomeOverlay.jsx';

beforeEach(() => {
  // Pin Math.random so pickWelcomeMessage returns the first message.
  vi.spyOn(Math, 'random').mockReturnValue(0);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('WelcomeOverlay', () => {
  it('renders a welcome message and the tap-to-continue hint', () => {
    render(<WelcomeOverlay onDismiss={() => {}} />);
    expect(screen.getByText(/tap to continue/i)).toBeTruthy();
  });

  it('dismisses ~600ms after a tap', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<WelcomeOverlay onDismiss={onDismiss} />);

    fireEvent.click(screen.getByText(/tap to continue/i));
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses at 5300ms when left alone', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<WelcomeOverlay onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(5299);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
