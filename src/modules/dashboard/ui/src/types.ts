export type DashboardTab = 'setup' | 'apis';
export type EndpointFilter = 'all' | 'stateful' | 'stateless';

export interface Workspace {
  configName: string;
  agreementName: string;
  baseUrl: string;
  port: number;
  seed: string;
  endpointCount: number;
  collectionCount: number;
}

export interface RequestField {
  field: string;
  location: string;
  type: string;
  required: boolean;
  behavior?: string;
}

export interface Endpoint {
  key: string;
  name: string;
  method: string;
  path: string;
  collection?: string;
  authentication: string;
  requestBodyContentType: string;
  successStatus: number;
  successResponseSchema?: unknown;
  requestFields: RequestField[];
  statuses: number[];
  override?: number;
}

export interface EndpointGroup {
  label: string;
  endpoints: Endpoint[];
}

export interface CapturedEvent {
  id: string;
  endpointKey: string;
  method: string;
  url: string;
  status: number;
  capturedAt: string;
}

export interface Recorder {
  active: boolean;
  events: CapturedEvent[];
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  steps: CapturedEvent[];
}

export interface ScenarioRun {
  passed: number;
  failed: number;
}

export interface CollectionSnapshot {
  name: string;
  records: Array<Record<string, unknown>>;
}

export interface DashboardData {
  workspace: Workspace;
  endpoints: Endpoint[];
  collections: CollectionSnapshot[];
}
