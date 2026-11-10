import type { NormalizedAgreement, NormalizedEndpoint } from '../../agreement/types.js';
import type { SimulatorConfig } from '../../config/types.js';
import type { CoercedRequest } from '../../engine/types.js';
import type { StatefulRuntime } from '../../state/types/index.js';

export interface CapturedRequest {
  id: string;
  endpointKey: string;
  method: string;
  path: string;
  url: string;
  query: Record<string, unknown>;
  params: Record<string, unknown>;
  headers: Record<string, string>;
  body?: unknown;
  status: number;
  responseBody?: unknown;
  capturedAt: string;
}

export interface ScenarioStep extends CapturedRequest {
  expectedStatus: number;
  assertSchema: boolean;
}

export interface DashboardScenario {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  agreementPath?: string;
  createdAt: string;
  updatedAt: string;
  steps: ScenarioStep[];
}

export interface ScenarioRunStep {
  id: string;
  method: string;
  url: string;
  expectedStatus: number;
  actualStatus: number;
  passed: boolean;
  responseBody?: unknown;
}

export interface DashboardContext {
  config: SimulatorConfig;
  agreement: NormalizedAgreement;
  runtime: StatefulRuntime;
}

export interface CaptureInput {
  endpoint: NormalizedEndpoint;
  request: CoercedRequest;
  method: string;
  url: string;
  headers: Record<string, unknown>;
  status: number;
  responseBody?: unknown;
}

export interface DashboardController {
  /** Shared agreement, server configuration and mutable mock runtime. */
  readonly context: DashboardContext;
  /**
   * @param endpoint - The normalized endpoint to identify.
   * @returns The stable `METHOD /path` identifier used by dashboard controls.
   */
  endpointKey(endpoint: NormalizedEndpoint): string;
  /**
   * @param endpoint - The endpoint whose override should be read.
   * @returns The in-memory status override, or `undefined` when none is active.
   */
  getOverride(endpoint: NormalizedEndpoint): number | undefined;
  /**
   * @param endpointKey - The stable endpoint identifier.
   * @param status - The status to force, or `undefined` to restore normal behavior.
   */
  setOverride(endpointKey: string, status: number | undefined): void;
  /** @param input - The completed request and response data to capture. */
  capture(input: CaptureInput): void;
  /** Begins a fresh recording session and clears previously captured events. */
  startRecording(): void;
  /** @returns A copy of the events from the completed recording session. */
  stopRecording(): CapturedRequest[];
  /** @returns A snapshot of the active flag and recorded requests. */
  recordingStatus(): { active: boolean; events: CapturedRequest[] };
  /** @returns Scenarios persisted in the current workspace. */
  listScenarios(): DashboardScenario[];
  /**
   * @param input - Scenario metadata and selected recorded-event identifiers.
   * @returns The persisted scenario.
   */
  saveScenario(input: { id?: string; name: string; description?: string; eventIds: string[] }): DashboardScenario;
  /** @param id - The identifier of the persisted scenario to remove. */
  deleteScenario(id: string): void;
  /** Resets shared collections/PRNG and overrides while preserving recordings/scenarios. */
  resetRuntime(): void;
  /** @returns Copied collection records for read-only inspection. */
  snapshotCollections(): Array<{ name: string; records: Array<Record<string, unknown>> }>;
}
