import type {
  CollectionSnapshot,
  DashboardData,
  Endpoint,
  Recorder,
  Scenario,
  ScenarioRun,
  Workspace
} from './types';

// The iframe is served by Moksy, so relative requests always use that same server.
const ROOT = '/_moksy/api';

/**
 * Sends a same-origin dashboard request and exposes server failures as errors.
 *
 * @typeParam T - The expected JSON response type.
 * @param path - The dashboard API path relative to `/_moksy/api`.
 * @param init - Optional Fetch API request options.
 * @returns The parsed response body.
 * @throws An error containing the server message when the response is unsuccessful.
 */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const response = await fetch(`${ROOT}${path}`, {
    ...init,
    headers
  });
  const body = response.status === 204 ? undefined : await response.json();
  if (!response.ok) throw new Error(body?.message ?? 'Dashboard request failed');
  return body as T;
}

/**
 * Loads the resources used by the visible Setup and APIs screens.
 *
 * @param signal - Optional signal used to cancel all dashboard requests.
 * @returns The workspace, endpoint catalog, and collection snapshots.
 */
export async function loadDashboard(signal?: AbortSignal): Promise<DashboardData> {
  const [workspace, endpoints, collections] = await Promise.all([
    request<Workspace>('/workspace', { signal }),
    request<Endpoint[]>('/endpoints', { signal }),
    request<CollectionSnapshot[]>('/collections', { signal })
  ]);
  return { workspace, endpoints, collections };
}

/** @returns A promise that resolves after runtime data and response overrides are reset. */
export async function resetWorkspace(): Promise<void> {
  await request('/workspace/reset', { method: 'POST' });
}

/**
 * Applies an agreement-declared status to one endpoint.
 *
 * @param key - The stable endpoint identifier.
 * @param status - The agreed HTTP status to activate.
 * @returns A promise that resolves after the override is applied.
 */
export async function applyResponseStatus(key: string, status: number): Promise<void> {
  await request(`/endpoints/${encodeURIComponent(key)}/override`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
}

/**
 * Removes an endpoint override so its normal response can run again.
 *
 * @param key - The stable endpoint identifier.
 * @returns A promise that resolves after the override is removed.
 */
export async function resetResponseStatus(key: string): Promise<void> {
  await request(`/endpoints/${encodeURIComponent(key)}/override`, { method: 'DELETE' });
}

/**
 * Loads the retained Testing feature when its container is mounted.
 *
 * @param signal - Optional signal used to cancel both requests.
 * @returns Recorder state and saved scenarios.
 */
export async function loadTesting(signal?: AbortSignal) {
  const [recorder, scenarios] = await Promise.all([
    request<Recorder>('/recorder', { signal }),
    request<Scenario[]>('/scenarios', { signal })
  ]);
  return { recorder, scenarios };
}

/**
 * Starts a fresh recording or stops the active recording.
 *
 * @param active - `true` to start recording; `false` to stop.
 * @returns A promise that resolves after the recording state changes.
 */
export async function setRecording(active: boolean): Promise<void> {
  await request(`/recorder/${active ? 'start' : 'stop'}`, { method: 'POST' });
}

/**
 * Persists selected recorded requests as a named scenario.
 *
 * @param name - The scenario name.
 * @param eventIds - Identifiers of the captured requests to include.
 * @returns A promise that resolves after the scenario is saved.
 */
export async function saveScenario(name: string, eventIds: string[]): Promise<void> {
  await request('/scenarios', {
    method: 'POST',
    body: JSON.stringify({ name, eventIds })
  });
}

/**
 * Replays a saved scenario through the active Moksy server.
 *
 * @param id - The identifier of the scenario to replay.
 * @returns The scenario replay result.
 */
export function runScenario(id: string): Promise<ScenarioRun> {
  return request(`/scenarios/${encodeURIComponent(id)}/run`, { method: 'POST' });
}

/**
 * Deletes a saved scenario from the local scenario store.
 *
 * @param id - The identifier of the scenario to delete.
 * @returns A promise that resolves after deletion.
 */
export async function deleteScenario(id: string): Promise<void> {
  await request(`/scenarios/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
