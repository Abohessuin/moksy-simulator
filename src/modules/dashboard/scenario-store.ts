import fs from 'node:fs';
import path from 'node:path';
import type { DashboardScenario } from './types/index.js';

/** Persists dashboard scenarios in one workspace-local JSON file. */
export class ScenarioStore {
  /**
   * Creates a scenario store.
   *
   * @param filePath - Scenario JSON path. Defaults to `.moksy/scenarios.json` in the workspace.
   */
  constructor(private readonly filePath = path.resolve(process.cwd(), '.moksy/scenarios.json')) {}

  /**
   * Reads saved scenarios.
   *
   * @returns Saved scenarios, or an empty array when the file is missing or unreadable.
   */
  read(): DashboardScenario[] {
    try {
      const value = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  /**
   * Replaces the scenario file via a temporary file to avoid partially written JSON.
   *
   * @param scenarios - The complete scenario collection to persist.
   */
  write(scenarios: DashboardScenario[]): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(scenarios, null, 2)}\n`, 'utf8');
    fs.renameSync(temporaryPath, this.filePath);
  }
}
