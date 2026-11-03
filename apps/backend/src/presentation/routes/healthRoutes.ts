import type { Env } from '@backend/src/db/connection';
import { HealthRepository } from '@backend/src/infrastructure/repositories/health/HealthRepository';
import type { IHealthRepository } from '@backend/src/infrastructure/repositories/health/IHealthRepository';
import { checkHealth } from '@backend/src/presentation/controllers/healthController';
import { CheckDatabaseHealthUseCase } from '@backend/src/use-cases/health/CheckDatabaseHealthUseCase';
import { Hono } from 'hono';
import type { RepositoryFactory } from './requestDatabase';

export function createHealthRoutes(
    repositoryFactory: RepositoryFactory<IHealthRepository> = (
        _env,
        database,
    ) => new HealthRepository(database()),
) {
    // GET /api/health - DB疎通確認
    return new Hono<{ Bindings: Env }>().get('/health', async (c) => {
        const repository = repositoryFactory(c.env, c.get('databaseClient'));
        const useCase = new CheckDatabaseHealthUseCase(repository);
        return checkHealth(c, useCase);
    });
}
