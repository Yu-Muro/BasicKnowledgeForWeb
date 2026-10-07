import type { createDatabaseClient, Env } from '@backend/src/db/connection';
export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
export type DatabaseProvider = () => DatabaseClient;
export type RepositoryFactory<T> = (env: Env, database?: DatabaseProvider) => T;
declare module 'hono' {
    interface ContextVariableMap {
        databaseClient: DatabaseProvider;
    }
}
