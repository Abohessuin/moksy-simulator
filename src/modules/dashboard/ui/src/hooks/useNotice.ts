import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Manages a short-lived notification and disposes its timer on unmount.
 *
 * @returns The current notice and a function for displaying a new message.
 */
export function useNotice() {
  const [notice, setNotice] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /**
   * Replaces the current notification and restarts its display duration.
   *
   * @param message - The notification text to display.
   */
  const notify = useCallback((message: string) => {
    clearTimeout(timer.current);
    setNotice(message);
    timer.current = setTimeout(() => setNotice(''), 2400);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  return { notice, notify };
}
