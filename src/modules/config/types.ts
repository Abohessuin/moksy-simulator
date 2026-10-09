export interface SimulatorConfig {
  host: string;
  port: number;
  basePath: string;
  allowedOrigins: string[];
  seed?: number;
  agreementPath: string;
  responses: Record<string, number>;
}

export interface RawSimulatorConfig {
  host?: string;
  port?: number;
  basePath?: string;
  allowedOrigins?: string[];
  seed?: number;
  agreementPath?: string;
  responses?: Record<string, number>;
}

export const DEFAULT_CONFIG: Omit<SimulatorConfig, 'agreementPath'> = {
  host: '127.0.0.1',
  port: 4500,
  basePath: '',
  allowedOrigins: ['*'],
  responses: {}
};
