import { randomUUID } from 'node:crypto';
import type { ScenarioStore } from '../scenario-store.js';
import type { CapturedRequest, DashboardContext, DashboardController, DashboardScenario } from '../types/index.js';

type ScenarioService = Pick<DashboardController, 'listScenarios' | 'saveScenario' | 'deleteScenario'>;

/**
 * Creates persistence operations for scenarios assembled from recorded events.
 *
 * @param context - The active dashboard context used for agreement metadata.
 * @param store - The store used to read and write scenarios.
 * @param getEvents - Reads the current recorder events.
 * @returns Scenario listing, saving, and deletion operations.
 */
export function createScenarioService(
  context: DashboardContext,
  store: ScenarioStore,
  getEvents: () => CapturedRequest[]
): ScenarioService {
  return {
    /**
     * Reads saved scenarios.
     *
     * @returns All scenarios currently stored in the workspace.
     */
    listScenarios(): DashboardScenario[] {
      return store.read();
    },
    /**
     * Creates or replaces a scenario while preserving capture order and creation time.
     *
     * @param input - The scenario metadata and selected captured-event identifiers.
     * @returns The newly persisted scenario.
     */
    saveScenario(input): DashboardScenario {
      const scenarios = store.read();
      const existing = input.id ? scenarios.find((scenario) => scenario.id === input.id) : undefined;
      const selected = getEvents().filter((event) => input.eventIds.includes(event.id));
      const now = new Date().toISOString();
      const scenario: DashboardScenario = {
        schemaVersion: 1,
        id: existing?.id ?? randomUUID(),
        name: input.name.trim(),
        description: input.description?.trim() ?? '',
        agreementPath: context.agreement.filePath,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        steps: selected.map((event) => ({ ...event, expectedStatus: event.status, assertSchema: true }))
      };
      store.write(existing
        ? scenarios.map((item) => item.id === existing.id ? scenario : item)
        : [...scenarios, scenario]);
      return scenario;
    },
    /**
     * Removes one saved scenario without changing the recording session.
     *
     * @param id - The identifier of the scenario to remove.
     */
    deleteScenario(id): void {
      store.write(store.read().filter((scenario) => scenario.id !== id));
    }
  };
}
