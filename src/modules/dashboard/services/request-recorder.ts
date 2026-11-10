import { randomUUID } from 'node:crypto';
import type { NormalizedEndpoint } from '../../agreement/types.js';
import type { CaptureInput, CapturedRequest, DashboardController } from '../types/index.js';

const REDACTED = '[REDACTED]';
const SENSITIVE = /authorization|cookie|token|secret|password|api[-_]?key/i;
const MAX_CAPTURED_REQUESTS = 200;

type RequestRecorder = Pick<DashboardController,
  'capture' | 'startRecording' | 'stopRecording' | 'recordingStatus'>;

/**
 * Copies nested request and response data while replacing sensitive field values.
 *
 * @param value - The value to clone and sanitize.
 * @param key - The current property name, used to identify sensitive values.
 * @returns A sanitized clone of the supplied value.
 */
function sanitize(value: unknown, key = ''): unknown {
  if (SENSITIVE.test(key)) return REDACTED;
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey)]));
  }
  return value;
}

/**
 * Creates a bounded in-memory request recorder that excludes replayed calls.
 *
 * @param endpointKey - Creates the stable key stored with each captured endpoint.
 * @returns Request recording operations backed by an isolated in-memory session.
 */
export function createRequestRecorder(
  endpointKey: (endpoint: NormalizedEndpoint) => string
): RequestRecorder {
  let recording = false;
  let events: CapturedRequest[] = [];

  return {
    /**
     * Records a completed mock request when a recording session is active.
     *
     * @param input - The completed request and response data to capture.
     */
    capture(input: CaptureInput): void {
      if (!recording || input.headers['x-moksy-runner']) return;
      const captured: CapturedRequest = {
        id: randomUUID(),
        endpointKey: endpointKey(input.endpoint),
        method: input.method,
        path: input.endpoint.path,
        url: input.url,
        query: sanitize(input.request.query) as Record<string, unknown>,
        params: sanitize(input.request.params) as Record<string, unknown>,
        headers: sanitize(input.headers) as Record<string, string>,
        body: sanitize(input.request.body),
        status: input.status,
        responseBody: sanitize(input.responseBody),
        capturedAt: new Date().toISOString()
      };
      events = [...events.slice(-(MAX_CAPTURED_REQUESTS - 1)), captured];
    },
    /** Starts a new session, discarding requests captured in the previous one. */
    startRecording(): void {
      events = [];
      recording = true;
    },
    /**
     * Stops capturing requests.
     *
     * @returns A deep copy of the completed recording session.
     */
    stopRecording(): CapturedRequest[] {
      recording = false;
      return structuredClone(events);
    },
    /**
     * Reads the current recording state.
     *
     * @returns The active flag and a deep copy of captured events.
     */
    recordingStatus() {
      return { active: recording, events: structuredClone(events) };
    }
  };
}
