/**
 * Displays an HTTP method using the dashboard method colors.
 *
 * @param props - The HTTP method value to display.
 * @returns The styled method badge.
 */
export function Method({ value }: { value: string }) {
  return <span className={`method method-${value.toLowerCase()}`}>{value}</span>;
}
