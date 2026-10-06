import { createDatabaseClient, type Env } from '../../db/connection';
import type { IAuthenticationRepository } from '../../infrastructure/repositories/auth/IAuthenticationRepository';

export type AuthenticationFactory = (
    env: Env,
) => Promise<IAuthenticationRepository>;

// Keep the ESM-only library outside Jest's repository-mocked feature tests.
export const createAuthenticationRepository: AuthenticationFactory = async (
    env,
) => {
    const { BetterAuthRepository } = await import(
        '../../infrastructure/repositories/auth/BetterAuthRepository'
    );
    return new BetterAuthRepository(createDatabaseClient(env), {
        secret: env.BETTER_AUTH_SECRET,
        baseURL: env.BETTER_AUTH_URL,
    });
};
