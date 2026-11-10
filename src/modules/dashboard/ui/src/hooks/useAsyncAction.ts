import { useCallback, useRef, useState } from 'react';

/**
 * Converts an unknown rejection into a readable dashboard message.
 *
 * @param reason - The value caught from a rejected operation.
 * @returns The original error message or a safe fallback.
 */
export function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Dashboard request failed';
}

/**
 * Tracks one pending action and catches failures before they reach an event handler.
 *
 * @returns Pending state, the latest error message, and a serialized action runner.
 */
export function useAsyncAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);

  /**
   * Serializes actions for this container and keeps failures visible in its view.
   *
   * @param action - The asynchronous operation to execute.
   * @returns A promise that resolves after the action and state cleanup complete.
   */
  const run = useCallback(async (action: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setPending(true);
    setError('');
    try {
      await action();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      running.current = false;
      setPending(false);
    }
  }, []);

  return { pending, error, run };
}
