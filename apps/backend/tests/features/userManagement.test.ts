import type { Env } from '@backend/src/db/connection';
import type {
    IUserRepository,
    User,
} from '@backend/src/infrastructure/repositories/user/IUserRepository';
import { contentAccessMiddleware } from '@backend/src/presentation/middleware/contentAccessMiddleware';
import { createAuthenticationContext } from '@backend/src/presentation/routes/authenticationContext';
import { createAuthRoutes } from '@backend/src/presentation/routes/authRoutes';
import { createDepartmentRoutes } from '@backend/src/presentation/routes/departmentRoutes';
import { createRoomRoutes } from '@backend/src/presentation/routes/roomRoutes';
import { createUserRoutes } from '@backend/src/presentation/routes/userRoutes';
import { describe, expect, it, jest } from '@jest/globals';
import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import {
    department,
    departmentRepository,
} from '../helpers/departmentRepository';

const env = { JWT_SECRET: 'test-secret' } as Env;
const id = 'abcdefab-0000-4000-8000-000000000001';
const admin: User = {
    id,
    name: '管理者',
    email: 'admin@test.com',
    password: 'hash',
    role: 'admin',
    departmentId: null,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    sessionVersion: 0,
};
function repository(overrides: Partial<IUserRepository> = {}): IUserRepository {
    return {
        findAll: async () => [],
        findById: async () => admin,
        findByEmail: async () => null,
        create: async () => admin,
        updateRole: async () => admin,
        updateDepartment: async () => admin,
        restore: async () => null,
        softDelete: async () => true,
        updatePassword: async () => {},
        ...overrides,
    };
}
async function cookie(role = 'admin') {
    return `auth_token=${await sign({ id, role, exp: Math.floor(Date.now() / 1000) + 3600 }, env.JWT_SECRET)}`;
}
function app(repo: IUserRepository, pending = false) {
    const app = new Hono<{ Bindings: Env }>();
    app.use(
        '/api/*',
        createAuthenticationContext(
            () => repo,
            () => ({ isDepartmentMigrationPending: async () => pending }),
        ),
    );
    app.route(
        '/api',
        createAuthRoutes(() => repo),
    );
    app.route('/api', createRoomRoutes());
    app.get('/api/future-content', contentAccessMiddleware, (c) =>
        c.json({ items: [] }),
    );
    app.get('/api/timetable', contentAccessMiddleware, (c) =>
        c.json({ items: [] }),
    );
    app.route(
        '/api',
        createUserRoutes(
            () => repo,
            () => departmentRepository,
        ),
    );
    app.route(
        '/api',
        createDepartmentRoutes(() => departmentRepository),
    );
    return app;
}
const target = '00000000-0000-4000-8000-000000000002';
describe('ユーザー管理とセッションの失効', () => {
    it('管理者だけが他のユーザーを論理削除できる', async () => {
        const softDelete = jest
            .fn<IUserRepository['softDelete']>()
            .mockResolvedValue(true);
        const res = await app(repository({ softDelete })).request(
            `/api/users/${target}`,
            { method: 'DELETE', headers: { Cookie: await cookie() } },
            env,
        );
        expect(res.status).toBe(200);
        expect(softDelete).toHaveBeenCalledWith(target);
    });
    it('自分自身は削除できない', async () => {
        const softDelete = jest.fn<IUserRepository['softDelete']>();
        const res = await app(repository({ softDelete })).request(
            `/api/users/${id}`,
            { method: 'DELETE', headers: { Cookie: await cookie() } },
            env,
        );
        expect(res.status).toBe(400);
        expect(softDelete).not.toHaveBeenCalled();
    });
    it.each(['DELETE', 'PUT'])(
        '一般ユーザーの管理操作 %s を拒否する',
        async (method) => {
            const repo = repository({
                findById: async () => ({
                    ...admin,
                    role: 'user',
                    departmentId: department.id,
                }),
            });
            const res = await app(repo).request(
                `/api/users/${target}${method === 'PUT' ? '/department' : ''}`,
                { method, headers: { Cookie: await cookie('user') } },
                env,
            );
            expect(res.status).toBe(403);
        },
    );
    it('削除済みユーザーの有効な古いトークンを拒否する', async () => {
        const res = await app(
            repository({
                findById: async () => ({ ...admin, deletedAt: new Date() }),
            }),
        ).request('/api/users', { headers: { Cookie: await cookie() } }, env);
        expect(res.status).toBe(401);
    });
    it('管理者から降格後の古い管理者トークンを拒否する', async () => {
        const repo = repository({
            findById: async () => ({
                ...admin,
                role: 'user',
                departmentId: department.id,
            }),
        });
        const res = await app(repo).request(
            '/api/departments',
            {
                method: 'POST',
                headers: {
                    Cookie: await cookie(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: '新部署' }),
            },
            env,
        );
        expect(res.status).toBe(403);
    });
    it('所属未設定の既存一般ユーザーを拒否する', async () => {
        const res = await app(
            repository({ findById: async () => ({ ...admin, role: 'user' }) }),
        ).request(
            '/api/users',
            { headers: { Cookie: await cookie('user') } },
            env,
        );
        expect(res.status).toBe(403);
    });
    it('DBが取得できない場合は管理操作を通さない', async () => {
        const res = await app(
            repository({
                findById: async () => {
                    throw new Error('offline');
                },
            }),
        ).request('/api/users', { headers: { Cookie: await cookie() } }, env);
        expect(res.status).toBe(503);
    });
    it('一般ユーザーへのロール変更は部署が必要', async () => {
        const res = await app(repository()).request(
            `/api/users/${target}/role`,
            {
                method: 'PUT',
                headers: {
                    Cookie: await cookie(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ role: 'user' }),
            },
            env,
        );
        expect(res.status).toBe(400);
    });
    it('ロールと部署を一緒に更新する', async () => {
        const updateRole = jest
            .fn<IUserRepository['updateRole']>()
            .mockResolvedValue(admin);
        const res = await app(repository({ updateRole })).request(
            `/api/users/${target}/role`,
            {
                method: 'PUT',
                headers: {
                    Cookie: await cookie(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    role: 'user',
                    departmentId: department.id,
                }),
            },
            env,
        );
        expect(res.status).toBe(200);
        expect(updateRole).toHaveBeenCalledWith(target, 'user', department.id);
    });
    it('管理者が既存ユーザーの部署を指定できる', async () => {
        const updateDepartment = jest
            .fn<IUserRepository['updateDepartment']>()
            .mockResolvedValue(admin);
        const res = await app(repository({ updateDepartment })).request(
            `/api/users/${target}/department`,
            {
                method: 'PUT',
                headers: {
                    Cookie: await cookie(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ departmentId: department.id }),
            },
            env,
        );
        expect(res.status).toBe(200);
        expect(updateDepartment).toHaveBeenCalledWith(target, department.id);
    });
    it('存在しない部署への所属変更を拒否する', async () => {
        const res = await app(repository()).request(
            `/api/users/${target}/department`,
            {
                method: 'PUT',
                headers: {
                    Cookie: await cookie(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ departmentId: target }),
            },
            env,
        );
        expect(res.status).toBe(400);
    });
    it('管理者として自己登録できない', async () => {
        const res = await app(repository()).request(
            '/api/users',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: '攻撃者',
                    email: 'new@test.com',
                    password: 'password123',
                    departmentId: department.id,
                    role: 'admin',
                }),
            },
            env,
        );
        expect(res.status).toBe(400);
    });
});

describe('レビュー指摘の回帰', () => {
    it('大文字UUIDでも自己削除を拒否する', async () => {
        const softDelete = jest.fn<IUserRepository['softDelete']>();
        const res = await app(repository({ softDelete })).request(
            `/api/users/${id.toUpperCase()}`,
            { method: 'DELETE', headers: { Cookie: await cookie() } },
            env,
        );
        expect(res.status).toBe(400);
        expect(softDelete).not.toHaveBeenCalled();
    });
    it('現在のDBの部署をme応答に含める', async () => {
        const current = { ...admin, role: 'user', departmentId: department.id };
        const token = await sign(
            {
                id,
                role: 'admin',
                departmentId: target,
                exp: Math.floor(Date.now() / 1000) + 3600,
            },
            env.JWT_SECRET,
        );
        const res = await app(
            repository({ findById: async () => current }),
        ).request(
            '/api/auth/me',
            { headers: { Cookie: `auth_token=${token}` } },
            env,
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({
            role: 'user',
            departmentId: department.id,
        });
    });
    it.each(['expired', 'tampered', 'deleted', 'unassigned'])(
        '有効な会期アクセスは%sのユーザー認証に影響されない',
        async (state) => {
            const token =
                state === 'tampered'
                    ? 'invalid'
                    : await sign(
                          {
                              id,
                              role: 'admin',
                              exp:
                                  Math.floor(Date.now() / 1000) +
                                  (state === 'expired' ? -60 : 3600),
                          },
                          env.JWT_SECRET,
                      );
            const access = await sign(
                { event_id: target, exp: Math.floor(Date.now() / 1000) + 3600 },
                env.JWT_SECRET,
            );
            const repo = repository({
                findById: async () =>
                    state === 'deleted'
                        ? null
                        : { ...admin, role: 'user', departmentId: null },
            });
            const headers = {
                Cookie: `auth_token=${token}; access_token=${access}`,
                'x-event-id': target,
            };
            expect(
                (await app(repo).request('/api/timetable', { headers }, env))
                    .status,
            ).toBe(200);
            expect(
                (await app(repo).request('/api/users', { headers }, env))
                    .status,
            ).not.toBe(200);
        },
    );
    it.each(['mismatch', 'expired', 'tampered'])(
        '不正な会期アクセス%sは削除済み管理者で閲覧できない',
        async (state) => {
            const access =
                state === 'tampered'
                    ? 'invalid'
                    : await sign(
                          {
                              event_id: state === 'mismatch' ? id : target,
                              exp:
                                  Math.floor(Date.now() / 1000) +
                                  (state === 'expired' ? -60 : 3600),
                          },
                          env.JWT_SECRET,
                      );
            const res = await app(
                repository({ findById: async () => null }),
            ).request(
                '/api/timetable',
                {
                    headers: {
                        Cookie: `${await cookie()}; access_token=${access}`,
                        'x-event-id': target,
                    },
                },
                env,
            );
            expect(res.status).toBe(401);
        },
    );
});

describe('ルートごとの認証と移行中の書き込み', () => {
    it.each(['GET', 'HEAD'])(
        '新しいコンテンツルートの%sも古いauth cookieで妨げない',
        async (method) => {
            const access = await sign(
                { event_id: target, exp: Math.floor(Date.now() / 1000) + 3600 },
                env.JWT_SECRET,
            );
            const findById = jest.fn<IUserRepository['findById']>();
            const res = await app(repository({ findById })).request(
                '/api/future-content',
                {
                    method,
                    headers: {
                        Cookie: `auth_token=invalid; access_token=${access}`,
                        'x-event-id': target,
                    },
                },
                env,
            );
            expect(res.status).toBe(200);
            expect(findById).not.toHaveBeenCalled();
        },
    );
    it('公開ルートでは壊れたauth cookieでもDBを読まない', async () => {
        const findById = jest.fn<IUserRepository['findById']>();
        const res = await app(repository({ findById })).request(
            '/api/departments',
            { headers: { Cookie: 'auth_token=invalid' } },
            env,
        );
        expect(res.status).toBe(200);
        expect(findById).not.toHaveBeenCalled();
    });
    it.each(['/api/users', '/api/departments', '/api/rooms'])(
        '移行中の%sへの書き込みを拒否する',
        async (path) => {
            const res = await app(repository(), true).request(
                path,
                {
                    method: 'POST',
                    headers: {
                        Cookie: await cookie(),
                        'x-event-id': target,
                        'Content-Type': 'application/json',
                    },
                    body: '{}',
                },
                env,
            );
            expect(res.status).toBe(503);
            expect(res.headers.get('Retry-After')).toBe('30');
        },
    );
    it('移行中もユーザー一覧と会期閲覧は利用できる', async () => {
        const headers = { Cookie: await cookie(), 'x-event-id': target };
        expect(
            (
                await app(repository(), true).request(
                    '/api/users',
                    { headers },
                    env,
                )
            ).status,
        ).toBe(200);
        expect(
            (
                await app(repository(), true).request(
                    '/api/timetable',
                    { headers },
                    env,
                )
            ).status,
        ).toBe(200);
    });
});

it('認証リポジトリの構築失敗もJSONの503にする', async () => {
    const application = new Hono<{ Bindings: Env }>();
    application.use(
        '/api/*',
        createAuthenticationContext(() => {
            throw new Error('configuration');
        }),
    );
    application.route(
        '/api',
        createAuthRoutes(() => repository()),
    );
    const res = await application.request(
        '/api/auth/me',
        { headers: { Cookie: await cookie() } },
        env,
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
        error: '認証情報の確認に失敗しました',
    });
});

describe('削除済みユーザーの復元', () => {
    it.each(['admin', 'user'])(
        '削除済み一覧は管理者のみ閲覧できる (%s)',
        async (role) => {
            const findAll = jest
                .fn<IUserRepository['findAll']>()
                .mockResolvedValue([{ ...admin, deletedAt: new Date() }]);
            const repo = repository({
                findAll,
                findById: async () => ({
                    ...admin,
                    role,
                    departmentId: department.id,
                }),
            });
            const res = await app(repo).request(
                '/api/users/deleted',
                { headers: { Cookie: await cookie(role) } },
                env,
            );
            expect(res.status).toBe(role === 'admin' ? 200 : 403);
            if (role === 'admin') {
                expect(findAll).toHaveBeenCalledWith(true);
                expect(
                    ((await res.json()) as { users: object[] }).users[0],
                ).not.toHaveProperty('password');
            } else expect(findAll).not.toHaveBeenCalled();
        },
    );
    it.each([
        ['admin', false, 200],
        ['user', false, 403],
        ['admin', true, 503],
    ] as const)(
        '復元の権限と移行中の制限 %s/%s',
        async (role, pending, status) => {
            const restore = jest
                .fn<IUserRepository['restore']>()
                .mockResolvedValue({
                    ...admin,
                    id: target,
                    role: 'user',
                    departmentId: department.id,
                    sessionVersion: 1,
                });
            const repo = repository({
                restore,
                findById: async (lookup) =>
                    lookup === id
                        ? { ...admin, role, departmentId: department.id }
                        : {
                              ...admin,
                              id: target,
                              role: 'user',
                              deletedAt: new Date(),
                          },
            });
            const res = await app(repo, pending).request(
                `/api/users/${target}/restore`,
                {
                    method: 'POST',
                    headers: {
                        Cookie: await cookie(role),
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ departmentId: department.id }),
                },
                env,
            );
            expect(res.status).toBe(status);
            if (status === 200)
                expect(restore).toHaveBeenCalledWith(target, department.id, 0);
            else expect(restore).not.toHaveBeenCalled();
        },
    );
    it('復元後の再ログインだけを許可しメールアドレス再登録は拒否する', async () => {
        const { hash } = await import('bcryptjs');
        const restored = {
            ...admin,
            id: target,
            sessionVersion: 1,
            password: await hash('password123', 1),
        };
        const repo = repository({
            findById: async () => restored,
            findByEmail: async () => restored,
        });
        const api = app(repo);
        const oldToken = await sign(
            {
                id: target,
                role: 'admin',
                exp: Math.floor(Date.now() / 1000) + 3600,
            },
            env.JWT_SECRET,
        );
        expect(
            (
                await api.request(
                    '/api/users',
                    { headers: { Cookie: `auth_token=${oldToken}` } },
                    env,
                )
            ).status,
        ).toBe(401);
        const login = await api.request(
            '/api/auth/login',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: restored.email,
                    password: 'password123',
                }),
            },
            env,
        );
        expect(login.status).toBe(200);
        const token = login.headers.get('set-cookie')!.split(';')[0];
        expect(
            (
                await api.request(
                    '/api/users',
                    { headers: { Cookie: token } },
                    env,
                )
            ).status,
        ).toBe(200);
        const deletedRepo = repository({
            findByEmail: async () => ({ ...restored, deletedAt: new Date() }),
        });
        const registration = await app(deletedRepo).request(
            '/api/users',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'スタッフ',
                    email: restored.email,
                    password: 'password123',
                    departmentId: department.id,
                }),
            },
            env,
        );
        expect(registration.status).toBe(400);
    });
});
