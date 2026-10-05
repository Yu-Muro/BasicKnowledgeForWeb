import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { Env } from '@backend/src/db/connection';
import type {
    IUserRepository,
    User,
    UserPublic,
} from '@backend/src/infrastructure/repositories/user/IUserRepository';
import { sign } from 'hono/jwt';
import { createTestAppWithUsers } from '../helpers/createTestApp';

const JWT_SECRET = 'test-secret';
const mockEnv = { JWT_SECRET } as unknown as Env;

const USER_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002';

const mockUser: User = {
    id: USER_ID,
    name: 'テストユーザー',
    email: 'test@example.com',
    password: 'hashedPassword',
    role: 'user',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    departmentId: '60000000-0000-4000-8000-000000000001',
    deletedAt: null,
};

let adminToken: string;
let userToken: string;

beforeAll(async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    adminToken = await sign(
        { id: 'admin-id', name: 'Admin', email: 'admin@test.com', role: 'admin', exp },
        JWT_SECRET,
        'HS256',
    );
    userToken = await sign(
        { id: 'user-id', name: 'User', email: 'user@test.com', role: 'user', exp },
        JWT_SECRET,
        'HS256',
    );
});

function createMockUserRepository(
    overrides: Partial<IUserRepository> = {},
): IUserRepository {
    return {
        findAll: jest.fn<() => Promise<User[]>>().mockResolvedValue([]),
        findById: jest
            .fn<(id: string) => Promise<User | null>>()
            .mockResolvedValue(null),
        findByEmail: jest
            .fn<(email: string) => Promise<User | null>>()
            .mockResolvedValue(null),
        create: jest.fn<() => Promise<User>>().mockResolvedValue(mockUser),
        updateRole: jest
            .fn<(id: string, role: string) => Promise<User | null>>()
            .mockResolvedValue(null),
        updatePassword: jest
            .fn<(id: string, hashedPassword: string) => Promise<void>>()
            .mockResolvedValue(undefined),
        updateDepartment: async () => null,
        softDelete: async () => false,
        ...overrides,
    };
}

// ─── GET /api/users ───────────────────────────────────────────────────────────

describe('GET /api/users', () => {
    it('admin トークンでユーザー一覧（password なし）を返す', async () => {
        const repository = createMockUserRepository({
            findAll: jest
                .fn<() => Promise<User[]>>()
                .mockResolvedValue([mockUser]),
        });
        const app = createTestAppWithUsers(repository);

        const res = await app.request(
            '/api/users',
            { headers: { Cookie: `auth_token=${adminToken}` } },
            mockEnv,
        );
        const body = await res.json() as { users: UserPublic[] };

        expect(res.status).toBe(200);
        expect(body.users).toHaveLength(1);
        expect(body.users[0].email).toBe('test@example.com');
        expect(body.users[0]).not.toHaveProperty('password');
    });

    it('auth_token なしの場合 401 を返す', async () => {
        const repository = createMockUserRepository();
        const app = createTestAppWithUsers(repository);

        const res = await app.request('/api/users', {}, mockEnv);

        expect(res.status).toBe(401);
    });

    it('user ロールの場合 403 を返す', async () => {
        const repository = createMockUserRepository();
        const app = createTestAppWithUsers(repository);

        const res = await app.request(
            '/api/users',
            { headers: { Cookie: `auth_token=${userToken}` } },
            mockEnv,
        );

        expect(res.status).toBe(403);
    });

    it('ユーザーが存在しない場合、空配列を返す', async () => {
        const repository = createMockUserRepository();
        const app = createTestAppWithUsers(repository);

        const res = await app.request(
            '/api/users',
            { headers: { Cookie: `auth_token=${adminToken}` } },
            mockEnv,
        );
        const body = await res.json() as { users: UserPublic[] };

        expect(res.status).toBe(200);
        expect(body.users).toEqual([]);
    });
});

// ─── POST /api/users ──────────────────────────────────────────────────────────

describe('POST /api/users', () => {
    const validUserBody = {
        name: '新規ユーザー',
        email: 'new@example.com',
        password: 'password123',
        departmentId: '60000000-0000-4000-8000-000000000001',
    };

    it('正常なデータでユーザーを作成し、201を返す', async () => {
        const createdUser: User = {
            ...mockUser,
            name: '新規ユーザー',
            email: 'new@example.com',
        };
        const repository = createMockUserRepository({
            findByEmail: jest
                .fn<(email: string) => Promise<User | null>>()
                .mockResolvedValue(null),
            create: jest
                .fn<() => Promise<User>>()
                .mockResolvedValue(createdUser),
        });
        const app = createTestAppWithUsers(repository);

        const res = await app.request('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validUserBody),
        });
        const body = await res.json() as { user: Omit<User, 'password'> };

        expect(res.status).toBe(201);
        expect(body.user.email).toBe('new@example.com');
    });

    it('メールアドレスが既に存在する場合、400を返す', async () => {
        const repository = createMockUserRepository({
            findByEmail: jest
                .fn<(email: string) => Promise<User | null>>()
                .mockResolvedValue(mockUser),
        });
        const app = createTestAppWithUsers(repository);

        const res = await app.request('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validUserBody),
        });

        expect(res.status).toBe(400);
    });

    it('バリデーションエラー（メールアドレス不正）の場合、400を返す', async () => {
        const repository = createMockUserRepository();
        const app = createTestAppWithUsers(repository);

        const res = await app.request('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...validUserBody, email: 'invalid-email' }),
        });
        const body = await res.json() as { error: string };

        expect(res.status).toBe(400);
        expect(body.error).toBe('バリデーションエラー');
    });

    it('バリデーションエラー（パスワード短すぎ）の場合、400を返す', async () => {
        const repository = createMockUserRepository();
        const app = createTestAppWithUsers(repository);

        const res = await app.request('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...validUserBody, password: 'short' }),
        });

        expect(res.status).toBe(400);
    });
});

// ─── PUT /api/users/:id/role ──────────────────────────────────────────────────

describe('PUT /api/users/:id/role', () => {
    function putRoleRequest(
        app: ReturnType<typeof createTestAppWithUsers>,
        id: string,
        body: unknown,
        cookie?: string,
    ) {
        return app.request(
            `/api/users/${id}/role`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(cookie ? { Cookie: cookie } : {}),
                },
                body: JSON.stringify(body),
            },
            mockEnv,
        );
    }

    it('admin トークンでロール変更が成功し 200 を返す', async () => {
        const repository = createMockUserRepository({
            findById: jest
                .fn<(id: string) => Promise<User | null>>()
                .mockResolvedValue(mockUser),
            updateRole: jest
                .fn<(id: string, role: string) => Promise<User | null>>()
                .mockResolvedValue({ ...mockUser, role: 'admin' }),
        });
        const app = createTestAppWithUsers(repository);

        const res = await putRoleRequest(
            app,
            USER_ID,
            { role: 'admin' },
            `auth_token=${adminToken}`,
        );

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ message: 'ロールを変更しました' });
    });

    it('auth_token なしの場合 401 を返す', async () => {
        const repository = createMockUserRepository();
        const app = createTestAppWithUsers(repository);

        const res = await putRoleRequest(app, USER_ID, { role: 'admin' });

        expect(res.status).toBe(401);
    });

    it('user ロールの場合 403 を返す', async () => {
        const repository = createMockUserRepository();
        const app = createTestAppWithUsers(repository);

        const res = await putRoleRequest(
            app,
            USER_ID,
            { role: 'admin' },
            `auth_token=${userToken}`,
        );

        expect(res.status).toBe(403);
    });

    it('存在しないユーザー ID の場合 404 を返す', async () => {
        const repository = createMockUserRepository({
            findById: jest
                .fn<(id: string) => Promise<User | null>>()
                .mockResolvedValue(null),
        });
        const app = createTestAppWithUsers(repository);

        const res = await putRoleRequest(
            app,
            OTHER_USER_ID,
            { role: 'admin' },
            `auth_token=${adminToken}`,
        );

        expect(res.status).toBe(404);
    });

    it('不正な role 値の場合 400 を返す', async () => {
        const repository = createMockUserRepository();
        const app = createTestAppWithUsers(repository);

        const res = await putRoleRequest(
            app,
            USER_ID,
            { role: 'superadmin' },
            `auth_token=${adminToken}`,
        );

        expect(res.status).toBe(400);
    });
});
