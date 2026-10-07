import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { compare, hash } from 'bcryptjs';
import { APIError } from 'better-auth/api';
import { betterAuth } from 'better-auth/minimal';
import type { createDatabaseClient } from '../../../db/connection';
import {
    authAccounts,
    authRateLimits,
    authSessions,
    authVerifications,
    users,
} from '../../../db/schema';
import { MAX_PASSWORD_LENGTH } from '../../validators/passwordPolicy';
import { UserRepository } from '../user/UserRepository';
import type { IAuthenticationRepository } from './IAuthenticationRepository';

export function createBetterAuth(
    db: Pick<
        ReturnType<typeof createDatabaseClient>,
        'select' | 'insert' | 'update' | 'delete' | 'transaction' | 'execute'
    >,
    options: { secret: string; baseURL: string },
) {
    if (options.secret.length < 32)
        throw new Error('BETTER_AUTH_SECRET は32文字以上必要です');
    return betterAuth({
        secret: options.secret,
        baseURL: options.baseURL,
        trustedOrigins: [
            options.baseURL,
            ...(options.baseURL.startsWith('http://localhost:')
                ? ['http://localhost:8771']
                : []),
        ],
        database: drizzleAdapter(db, {
            provider: 'pg',
            schema: {
                user: users,
                session: authSessions,
                account: authAccounts,
                verification: authVerifications,
                rateLimit: authRateLimits,
            },
            transaction: true,
        }),
        emailAndPassword: {
            enabled: true,
            disableSignUp: true,
            maxPasswordLength: MAX_PASSWORD_LENGTH,
            password: {
                hash: (password) => hash(password, 12),
                verify: ({ password, hash: stored }) =>
                    compare(password, stored),
            },
        },
        session: {
            expiresIn: 60 * 60 * 24 * 7,
            disableSessionRefresh: true,
            cookieCache: { enabled: false },
        },
        rateLimit: { enabled: true, storage: 'database', window: 60, max: 30 },
        databaseHooks: {
            session: {
                create: {
                    before: async (session) => {
                        const user = await new UserRepository(db).findById(
                            session.userId,
                        );
                        if (!user || user.deletedAt)
                            throw new APIError('UNAUTHORIZED', {
                                message:
                                    'メールアドレスまたはパスワードが正しくありません',
                            });
                        if (user.role !== 'admin' && !user.departmentId)
                            throw new APIError('FORBIDDEN', {
                                message:
                                    '所属部署が未設定です。管理者に設定を依頼してください',
                            });
                    },
                },
            },
        },
        advanced: {
            ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
            database: { generateId: 'uuid' },
            cookies: {
                session_token: {
                    name: 'auth_token',
                    attributes: { httpOnly: true, sameSite: 'lax', path: '/' },
                },
            },
            // Preserve the existing cookie name; enforce Secure independently of name prefixes.
            useSecureCookies: false,
            defaultCookieAttributes: {
                secure: options.baseURL.startsWith('https://'),
            },
        },
    });
}

export class BetterAuthRepository implements IAuthenticationRepository {
    private readonly users: UserRepository;
    private readonly auth: ReturnType<typeof createBetterAuth>;
    constructor(
        db: Pick<
            ReturnType<typeof createDatabaseClient>,
            | 'select'
            | 'insert'
            | 'update'
            | 'delete'
            | 'transaction'
            | 'execute'
        >,
        private readonly options: { secret: string; baseURL: string },
    ) {
        this.users = new UserRepository(db);
        this.auth = createBetterAuth(db, options);
    }
    async signIn(
        email: string,
        password: string,
        headers: Headers,
    ): Promise<Response> {
        await this.users.ensureCredentialAccount(email);
        return this.call('sign-in/email', { email, password }, headers);
    }
    async signOut(headers: Headers): Promise<Response> {
        return this.call('sign-out', {}, headers);
    }
    async getSessionUserId(headers: Headers): Promise<string | null> {
        const session = await this.auth.api.getSession({ headers });
        return session?.user.id ?? null;
    }
    private call(
        path: string,
        body: object,
        original: Headers,
    ): Promise<Response> {
        const headers = new Headers(original);
        headers.set('Content-Type', 'application/json');
        headers.delete('Content-Length');
        return this.auth.handler(
            new Request(`${this.options.baseURL}/api/auth/${path}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            }),
        );
    }
}
