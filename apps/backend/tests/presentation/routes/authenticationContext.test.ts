import type { Env } from '@backend/src/db/connection';
import { createAuthenticationContext } from '@backend/src/presentation/routes/authenticationContext';
import type {
    DatabaseClient,
    RepositoryFactory,
} from '@backend/src/presentation/routes/requestDatabase';
import { createUserRoutes } from '@backend/src/presentation/routes/userRoutes';
import { describe, expect, it, jest } from '@jest/globals';
import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { user, userRepository } from '../../helpers/userRepository';
import { departmentRepository } from '../../helpers/departmentRepository';
const env = { JWT_SECRET: 'test-secret' } as Env;
const target = 'abcdefab-0000-4000-8000-000000000002';
async function cookie() {
    return `auth_token=${await sign({ id: user.id, role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }, env.JWT_SECRET)}`;
}
describe('リクエスト単位のDB共有', () => {
    it('認証・移行確認・復元・部署検索で1クライアントを共有し、別リクエストでは作り直す', async () => {
        const clients: DatabaseClient[] = [];
        const end = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
        const databaseFactory = jest
            .fn<(env: Env) => DatabaseClient>()
            .mockImplementation(() => {
                const client = {
                    $client: { end },
                } as unknown as DatabaseClient;
                clients.push(client);
                return client;
            });
        const seen: DatabaseClient[] = [];
        const repo = userRepository({
            findById: async (id) =>
                id === user.id
                    ? { ...user, role: 'admin' }
                    : { ...user, id: target, deletedAt: new Date() },
            restore: async () => ({ ...user, id: target, sessionVersion: 1 }),
        });
        const users: RepositoryFactory<typeof repo> = (_env, database) => {
            seen.push(database!());
            return repo;
        };
        const api = new Hono<{ Bindings: Env }>();
        api.use(
            '/api/*',
            createAuthenticationContext(
                users,
                (_env, database) => {
                    seen.push(database!());
                    return { isDepartmentMigrationPending: async () => false };
                },
                databaseFactory,
            ),
        );
        api.route(
            '/api',
            createUserRoutes(users, (_env, database) => {
                seen.push(database!());
                return departmentRepository;
            }),
        );
        for (let i = 0; i < 2; i++) {
            const response = await api.request(
                `/api/users/${target}/restore`,
                {
                    method: 'POST',
                    headers: {
                        Cookie: await cookie(),
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ departmentId: user.departmentId }),
                },
                env,
            );
            expect(response.status).toBe(200);
            expect(seen.slice(i * 4, i * 4 + 4)).toEqual(
                Array(4).fill(clients[i]),
            );
        }
        expect(databaseFactory).toHaveBeenCalledTimes(2);
        expect(clients[0]).not.toBe(clients[1]);
        expect(end).toHaveBeenCalledTimes(2);
    });
    it('登録の回数制限で拒否したら移行確認もDB生成もしない', async () => {
        const databaseFactory = jest.fn<(env: Env) => DatabaseClient>();
        const migrations =
            jest.fn<
                NonNullable<Parameters<typeof createAuthenticationContext>[1]>
            >();
        const api = new Hono<{ Bindings: Env }>();
        api.use(
            '/api/*',
            createAuthenticationContext(
                () => userRepository(),
                migrations,
                databaseFactory,
            ),
        );
        api.route(
            '/api',
            createUserRoutes(
                () => userRepository(),
                () => departmentRepository,
            ),
        );
        const res = await api.request(
            '/api/users',
            {
                method: 'POST',
                headers: { 'CF-Connecting-IP': '192.0.2.1' },
                body: '{}',
            },
            {
                ...env,
                PUBLIC_AUTH_RATE_LIMIT_ENABLED: 'true',
                PUBLIC_AUTH_RATE_LIMITER: {
                    limit: async () => ({ success: false }),
                },
            },
        );
        expect(res.status).toBe(429);
        expect(migrations).not.toHaveBeenCalled();
        expect(databaseFactory).not.toHaveBeenCalled();
    });
    it('公開ルートでは不要なDBを作らない', async () => {
        const databaseFactory = jest.fn<(env: Env) => DatabaseClient>();
        const api = new Hono<{ Bindings: Env }>();
        api.use(
            '*',
            createAuthenticationContext(
                () => userRepository(),
                undefined,
                databaseFactory,
            ),
        );
        api.get('/public', (c) => c.text('ok'));
        expect((await api.request('/public', {}, env)).status).toBe(200);
        expect(databaseFactory).not.toHaveBeenCalled();
    });
    it('ハンドラーが失敗してもDBを解放する', async () => {
        const end = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
        const api = new Hono<{ Bindings: Env }>();
        api.use(
            '*',
            createAuthenticationContext(
                () => userRepository(),
                undefined,
                () => ({ $client: { end } }) as unknown as DatabaseClient,
            ),
        );
        api.onError((_err, c) => c.text('error', 500));
        api.get('/fail', (c) => {
            c.get('databaseClient')();
            throw new Error('fail');
        });
        expect((await api.request('/fail', {}, env)).status).toBe(500);
        expect(end).toHaveBeenCalledTimes(1);
    });
});
