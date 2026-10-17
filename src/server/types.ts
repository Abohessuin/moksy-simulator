import { FastifyInstance } from 'fastify';
import { NormalizedAgreement } from '../modules/agreement/types.js';
import { SimulatorConfig } from '../modules/config/types.js';
import { Prng } from '../modules/engine/index.js';

export interface ServerOptions {
  config: SimulatorConfig;
  agreement: NormalizedAgreement;
  prng?: Prng;
}

export interface ServerInstance {
  app: FastifyInstance;
  listen: () => Promise<string>;
  close: () => Promise<void>;
}
