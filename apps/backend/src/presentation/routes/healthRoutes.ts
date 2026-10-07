import { createDatabaseClient, type Env } from '@backend/src/db/connection';
import { HealthRepository } from '@backend/src/infrastructure/repositories/health/HealthRepository';
import type { IHealthRepository } from '@backend/src/infrastructure/repositories/health/IHealthRepository';
import { checkHealth } from '@backend/src/presentation/controllers/healthController';
import { CheckDatabaseHealthUseCase } from '@backend/src/use-cases/health/CheckDatabaseHealthUseCase';
import { Hono } from 'hono';
import type { DatabaseProvider } from './requestDatabase';

type HealthRepositoryFactory = (
    env: Env,
    database?: DatabaseProvider,
) => IHealthRepository;

export function createHealthRoutes(
    repositoryFactory: HealthRepositoryFactory = (env, database) =>
        new HealthRepository(database?.() ?? createDatabaseClient(env)),
) {
    // GET /api/health - DB疎通確認
    return new Hono<{ Bindings: Env }>().get('/health', async (c) => {
        const repository = repositoryFactory(c.env, c.get('databaseClient'));
        const useCase = new CheckDatabaseHealthUseCase(repository);
        return checkHealth(c, useCase);
    });
}
