import { createDatabaseClient, type Env } from '@backend/src/db/connection';
import type { IMigrationStateRepository } from '@backend/src/infrastructure/repositories/migration/IMigrationStateRepository';
import { MigrationStateRepository } from '@backend/src/infrastructure/repositories/migration/MigrationStateRepository';
import type { IUserRepository } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import { UserRepository } from '@backend/src/infrastructure/repositories/user/UserRepository';
import { ValidateSessionUseCase } from '@backend/src/use-cases/auth/ValidateSessionUseCase';
import { CheckDepartmentWritesUseCase } from '@backend/src/use-cases/department/CheckDepartmentWritesUseCase';
import { createMiddleware } from 'hono/factory';
import type { AuthVariables } from '../middleware/authMiddleware';
// Composition root only: public routes never trigger authentication or DB reads.
export function createAuthenticationContext(
    users: (env: Env) => IUserRepository = (env) =>
        new UserRepository(createDatabaseClient(env)),
    migrations: (env: Env) => IMigrationStateRepository = (env) =>
        new MigrationStateRepository(createDatabaseClient(env)),
) {
    return createMiddleware<{ Bindings: Env; Variables: AuthVariables }>(
        async (c, next) => {
            c.set('jwtSecret', c.env.JWT_SECRET);
            c.set('sessionValidator', {
                execute: (claims) =>
                    new ValidateSessionUseCase(users(c.env)).execute(claims),
            });
            c.set('departmentWriteCheck', {
                execute: () =>
                    new CheckDepartmentWritesUseCase(
                        migrations(c.env),
                    ).execute(),
            });
            await next();
        },
    );
}
