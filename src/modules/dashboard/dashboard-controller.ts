import { createStatefulRuntime } from '../state/stateful-runtime.js';
import type { NormalizedEndpoint } from '../agreement/types.js';
import { ScenarioStore } from './scenario-store.js';
import { createRequestRecorder } from './services/request-recorder.js';
import { createScenarioService } from './services/scenario-service.js';
import type { DashboardContext, DashboardController } from './types/index.js';

/**
 * Identifies an agreement endpoint consistently across routes and recordings.
 *
 * @param endpoint - The normalized agreement endpoint to identify.
 * @returns A stable identifier in `METHOD /path` format.
 */
function endpointKey(endpoint: NormalizedEndpoint): string {
  return `${endpoint.method} ${endpoint.path}`;
}

/**
 * Composes dashboard controls around the runtime shared with mock route handlers.
 * Overrides and recordings live in memory; scenarios are delegated to their store.
 *
 * @param context - The agreement, configuration, Fastify app, and mutable runtime.
 * @param store - The persistent scenario store. Defaults to the workspace store.
 * @returns A controller exposing dashboard operations over the shared runtime.
 */
export function createDashboardController(
  context: DashboardContext,
  store = new ScenarioStore()
): DashboardController {
  const overrides = new Map<string, number>();
  const recorder = createRequestRecorder(endpointKey);
  const scenarios = createScenarioService(context, store, () => recorder.recordingStatus().events);

  return {
    context,
    endpointKey,
    ...recorder,
    ...scenarios,
    /**
     * Reads the temporary response status selected for an endpoint.
     *
     * @param endpoint - The endpoint whose override should be read.
     * @returns The overridden status, or `undefined` when normal behavior is active.
     */
    getOverride(endpoint): number | undefined {
      return overrides.get(endpointKey(endpoint));
    },
    /**
     * Sets or removes a temporary response status.
     *
     * @param key - The stable endpoint identifier.
     * @param status - The status to force, or `undefined` to restore normal behavior.
     */
    setOverride(key, status): void {
      if (status === undefined) overrides.delete(key);
      else overrides.set(key, status);
    },
    /** Regenerates shared mock data and clears overrides, retaining recordings/scenarios. */
    resetRuntime(): void {
      const fresh = createStatefulRuntime(context.agreement, context.config);
      context.runtime.prng = fresh.prng;
      context.runtime.collections = fresh.collections;
      overrides.clear();
    },
    /**
     * Copies collections for inspection without exposing mutable runtime records.
     *
     * @returns Collection names and cloned records from the active runtime.
     */
    snapshotCollections() {
      return [...context.runtime.collections.values()].map((collection) => ({
        name: collection.name,
        records: structuredClone(collection.records)
      }));
    }
  };
}
