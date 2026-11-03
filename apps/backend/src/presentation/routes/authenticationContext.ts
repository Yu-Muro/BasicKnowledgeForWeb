import { createDatabaseClient, type Env } from '@backend/src/db/connection';
import type { IMigrationStateRepository } from '@backend/src/infrastructure/repositories/migration/IMigrationStateRepository';
import { MigrationStateRepository } from '@backend/src/infrastructure/repositories/migration/MigrationStateRepository';
import type { IUserRepository } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import { UserRepository } from '@backend/src/infrastructure/repositories/user/UserRepository';
import { ValidateSessionUseCase } from '@backend/src/use-cases/auth/ValidateSessionUseCase';
import { CheckDepartmentWritesUseCase } from '@backend/src/use-cases/department/CheckDepartmentWritesUseCase';
import { createMiddleware } from 'hono/factory';
import type { AuthVariables } from '../middleware/authMiddleware';
import type { DatabaseClient, RepositoryFactory } from './requestDatabase';
// Composition root only: public routes never trigger authentication or DB reads.
export function createAuthenticationContext(
    users: RepositoryFactory<IUserRepository> = (_env, database) =>
        new UserRepository(database()),
    migrations?: RepositoryFactory<IMigrationStateRepository>,
    databaseFactory = createDatabaseClient,
) {
    // Completion only moves forward, scoped to this worker's auth context.
    const completion = { complete: false };
    const migrationFactory: RepositoryFactory<IMigrationStateRepository> =
        migrations ??
        ((_env, database) =>
            new MigrationStateRepository(database(), completion));
    return createMiddleware<{ Bindings: Env; Variables: AuthVariables }>(
        async (c, next) => {
            let client: DatabaseClient | undefined;
            const database = () => (client ??= databaseFactory(c.env));
            c.set('databaseClient', database);
            c.set('jwtSecret', c.env.JWT_SECRET);
            c.set('sessionValidator', {
                execute: (claims) =>
                    new ValidateSessionUseCase(users(c.env, database)).execute(
                        claims,
                    ),
            });
            c.set('departmentWriteCheck', {
                execute: () =>
                    new CheckDepartmentWritesUseCase(
                        migrationFactory(c.env, database),
                    ).execute(),
            });
            try {
                await next();
            } finally {
                if (client) {
                    const cleanup = client.$client
                        .end()
                        .catch((error: unknown) => {
                            // Do not log driver messages: they can contain connection secrets.
                            console.error('DB接続の解放に失敗しました', {
                                name:
                                    error instanceof Error
                                        ? error.name
                                        : 'UnknownError',
                                code:
                                    error &&
                                    typeof error === 'object' &&
                                    'code' in error &&
                                    typeof error.code === 'string' &&
                                    /^[A-Z0-9_]{1,40}$/.test(error.code)
                                        ? error.code
                                        : undefined,
                            });
                        });
                    let execution:
                        | Pick<typeof c.executionCtx, 'waitUntil'>
                        | undefined;
                    try {
                        execution = c.executionCtx;
                    } catch {
                        // Hono's local/test environment has no execution context.
                    }
                    if (execution) execution.waitUntil(cleanup);
                    else await cleanup;
                }
            }
        },
    );
}
