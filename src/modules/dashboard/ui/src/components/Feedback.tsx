/**
 * Announces a failed action while preserving the current screen and user input.
 *
 * @param props - The error message to announce.
 * @returns The action error element, or `null` when no message exists.
 */
export function ActionError({ message }: { message: string }) {
  return message ? (
    <p className="note dangerText" role="alert">{message}</p>
  ) : null;
}

/**
 * Displays an initial loading failure with a retry action.
 *
 * @param props - The failure message and retry callback.
 * @returns The dashboard load-error element.
 */
export function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="fatal">
      <h1>Moksy dashboard</h1>
      <p role="alert">{message}</p>
      <button onClick={onRetry}>Try again</button>
    </main>
  );
}

/**
 * Provides a loading state before the first workspace snapshot is available.
 *
 * @returns The dashboard loading element.
 */
export function DashboardLoading() {
  return <main className="fatal" role="status">Loading Moksy dashboard…</main>;
}
