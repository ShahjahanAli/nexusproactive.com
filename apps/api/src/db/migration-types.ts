import { PoolClient } from 'pg';

export interface MigrationModule {
  up: (client: PoolClient) => Promise<void>;
  down: (client: PoolClient) => Promise<void>;
}

export interface MigrationRecord {
  id: number;
  migration: string;
  batch: number;
}
