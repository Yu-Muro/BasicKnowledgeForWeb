import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { Env } from '@backend/src/db/connection';
import type {
    AccessCode,
    IAccessCodeRepository,
    NewAccessCode,
} from '@backend/src/infrastructure/repositories/access-code/IAccessCodeRepository';
import { sign } from 'hono/jwt';
import { createTestAppWithAccessCodes } from '../helpers/createTestApp';

const JWT_SECRET = 'test-secret';
const mockEnv = { JWT_SECRET } as unknown as Env;

// テスト用アクセスコード (有効期間: 未来)
const validAccessCode: AccessCode = {
    id: '00000000-0000-0000-0000-000000000002',
    code: 'SUMMER2025',
    eventName: 'Summer Event',
    validFrom: new Date('2020-01-01'),
    validTo: new Date('2099-12-31'),
    createdBy: '00000000-0000-0000-0000-000000000001',
    createdAt: new Date('2024-01-01'),
};

const newerAccessCode: AccessCode = {
    ...validAccessCode,
    id: '00000000-0000-0000-0000-000000000003',
    code: 'WINTER2025',
    eventName: 'Winter Event',
    validFrom: new Date('2025-01-01'),
    validTo: new Date('2099-12-31'),
};

// テスト用アクセスコード (有効期間: 過去 = 期限切れ)
const expiredAccessCode: AccessCode = {
    ...validAccessCode,
    validFrom: new Date('2020-01-01'),
    validTo: new Date('2020-12-31'),
};

let adminToken: string;
let userToken: string;
let userAccessToken: string; // access_token（event_id = validAccessCode.id）

beforeAll(async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;

    adminToken = await sign(
        {
            id: 'admin-id',
            name: 'Admin',
            email: 'admin@test.com',
            role: 'admin',
            exp,
        },
        JWT_SECRET,
        'HS256',
    );
    userToken = await sign(
        {
            id: 'user-id',
            name: 'User',
            email: 'user@test.com',
            role: 'user',
            exp,
        },
        JWT_SECRET,
        'HS256',
    );
    userAccessToken = await sign(
        { event_id: validAccessCode.id, exp },
        JWT_SECRET,
        'HS256',
    );
});

function createMockAccessCodeRepository(
    overrides: Partial<IAccessCodeRepository> = {},
): IAccessCodeRepository {
    return {
        findAll: jest.fn<() => Promise<AccessCode[]>>().mockResolvedValue([]),
        findById: jest
            .fn<(id: string) => Promise<AccessCode | null>>()
            .mockResolvedValue(null),
        findByCode: jest
            .fn<(code: string) => Promise<AccessCode | null>>()
            .mockResolvedValue(null),
        create: jest
            .fn<(input: NewAccessCode) => Promise<AccessCode>>()
            .mockImplementation(() => Promise.resolve(validAccessCode)),
        deleteById: jest
            .fn<(id: string) => Promise<boolean>>()
            .mockImplementation(() => Promise.resolve(true)),
        ...overrides,
    };
}

// ─── POST /api/access-codes/verify ───────────────────────────────────────────

describe('POST /api/access-codes/verify', () => {
    it('有効なアクセスコードで 200 と access_token Cookie が返ること', async () => {
        const repo = createMockAccessCodeRepository({
            findByCode: jest
                .fn<(code: string) => Promise<AccessCode | null>>()
                .mockImplementation(() => Promise.resolve(validAccessCode)),
        });
        const app = createTestAppWithAccessCodes(repo);

        const res = await app.request(
            '/api/access-codes/verify',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: 'SUMMER2025' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(200);
        expect(res.headers.get('set-cookie')).toContain('access_token=');
    });

    it('期限切れのアクセスコードで 401 が返ること', async () => {
        const repo = createMockAccessCodeRepository({
            findByCode: jest
                .fn<(code: string) => Promise<AccessCode | null>>()
                .mockImplementation(() => Promise.resolve(expiredAccessCode)),
        });
        const app = createTestAppWithAccessCodes(repo);

        const res = await app.request(
            '/api/access-codes/verify',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: 'EXPIRED2025' }),
            },
            mockEnv,
        );
        const body = (await res.json()) as { error: string };

        expect(res.status).toBe(401);
        expect(body.error).toContain('有効期限');
    });

    it('存在しないコードで 401 が返ること', async () => {
        const repo = createMockAccessCodeRepository({
            findByCode: jest
                .fn<(code: string) => Promise<AccessCode | null>>()
                .mockResolvedValue(null),
        });
        const app = createTestAppWithAccessCodes(repo);

        const res = await app.request(
            '/api/access-codes/verify',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: 'INVALID' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(401);
    });

    it('バリデーションエラー（空のコード）で 400 が返ること', async () => {
        const app = createTestAppWithAccessCodes(
            createMockAccessCodeRepository(),
        );

        const res = await app.request(
            '/api/access-codes/verify',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: '' }),
            },
            mockEnv,
        );
        const body = (await res.json()) as { error: string };

        expect(res.status).toBe(400);
        expect(body.error).toBe('バリデーションエラー');
    });
});

// ─── GET /api/access-codes ────────────────────────────────────────────────────

describe('GET /api/access-codes', () => {
    it('admin トークンがあれば 200 とアクセスコード一覧が返ること', async () => {
        const repo = createMockAccessCodeRepository({
            findAll: jest
                .fn<() => Promise<AccessCode[]>>()
                .mockResolvedValue([newerAccessCode, validAccessCode]),
        });
        const app = createTestAppWithAccessCodes(repo);

        const res = await app.request(
            '/api/access-codes',
            { headers: { Cookie: `auth_token=${adminToken}` } },
            mockEnv,
        );

        const body = (await res.json()) as { codes: AccessCode[] };

        expect(res.status).toBe(200);
        expect(body.codes).toHaveLength(2);
        expect(body.codes[0]?.id).toBe(newerAccessCode.id);
        expect(body.codes[1]?.id).toBe(validAccessCode.id);
    });

    it('Cookie なしで 401 が返ること', async () => {
        const app = createTestAppWithAccessCodes(
            createMockAccessCodeRepository(),
        );

        const res = await app.request('/api/access-codes', {}, mockEnv);

        expect(res.status).toBe(401);
    });

    it('user ロールのトークンで 403 が返ること', async () => {
        const app = createTestAppWithAccessCodes(
            createMockAccessCodeRepository(),
        );

        const res = await app.request(
            '/api/access-codes',
            { headers: { Cookie: `auth_token=${userToken}` } },
            mockEnv,
        );

        expect(res.status).toBe(403);
    });
});

// ─── POST /api/access-codes ───────────────────────────────────────────────────

describe('POST /api/access-codes', () => {
    const validBody = {
        code: 'EVENT2025',
        eventName: 'イベント2025',
        validFrom: '2025-01-01T00:00:00.000Z',
        validTo: '2025-12-31T23:59:59.000Z',
    };

    it('admin トークンがあれば 201 と code キーでアクセスコードが返ること', async () => {
        const app = createTestAppWithAccessCodes(
            createMockAccessCodeRepository(),
        );

        const res = await app.request(
            '/api/access-codes',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify(validBody),
            },
            mockEnv,
        );

        const body = (await res.json()) as { code: AccessCode };

        expect(res.status).toBe(201);
        expect(body.code.id).toBe(validAccessCode.id);
    });

    it('Cookie なしで 401 が返ること', async () => {
        const app = createTestAppWithAccessCodes(
            createMockAccessCodeRepository(),
        );

        const res = await app.request(
            '/api/access-codes',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validBody),
            },
            mockEnv,
        );

        expect(res.status).toBe(401);
    });

    it('user ロールのトークンで 403 が返ること', async () => {
        const app = createTestAppWithAccessCodes(
            createMockAccessCodeRepository(),
        );

        const res = await app.request(
            '/api/access-codes',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${userToken}`,
                },
                body: JSON.stringify(validBody),
            },
            mockEnv,
        );

        expect(res.status).toBe(403);
    });

    it('バリデーションエラー（validTo が validFrom より前）で 400 が返ること', async () => {
        const app = createTestAppWithAccessCodes(
            createMockAccessCodeRepository(),
        );

        const res = await app.request(
            '/api/access-codes',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({
                    ...validBody,
                    validTo: '2024-01-01T00:00:00.000Z', // validFrom より前
                }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });
});

// ─── DELETE /api/access-codes/:id ────────────────────────────────────────────

describe('DELETE /api/access-codes/:id', () => {
    const targetId = '00000000-0000-0000-0000-000000000002';

    it('admin トークンがあれば 200 が返ること', async () => {
        const app = createTestAppWithAccessCodes(
            createMockAccessCodeRepository(),
        );

        const res = await app.request(
            `/api/access-codes/${targetId}`,
            {
                method: 'DELETE',
                headers: { Cookie: `auth_token=${adminToken}` },
            },
            mockEnv,
        );

        expect(res.status).toBe(200);
    });

    it('対象が存在しない場合は 404 が返ること', async () => {
        const app = createTestAppWithAccessCodes(
            createMockAccessCodeRepository({
                deleteById: jest
                    .fn<(id: string) => Promise<boolean>>()
                    .mockResolvedValue(false),
            }),
        );

        const res = await app.request(
            `/api/access-codes/${targetId}`,
            {
                method: 'DELETE',
                headers: { Cookie: `auth_token=${adminToken}` },
            },
            mockEnv,
        );
        const body = (await res.json()) as { error: string };

        expect(res.status).toBe(404);
        expect(body.error).toBe('コードが見つかりません');
    });

    it('Cookie なしで 401 が返ること', async () => {
        const app = createTestAppWithAccessCodes(
            createMockAccessCodeRepository(),
        );

        const res = await app.request(
            `/api/access-codes/${targetId}`,
            { method: 'DELETE' },
            mockEnv,
        );

        expect(res.status).toBe(401);
    });

    it('user ロールのトークンで 403 が返ること', async () => {
        const app = createTestAppWithAccessCodes(
            createMockAccessCodeRepository(),
        );

        const res = await app.request(
            `/api/access-codes/${targetId}`,
            {
                method: 'DELETE',
                headers: { Cookie: `auth_token=${userToken}` },
            },
            mockEnv,
        );

        expect(res.status).toBe(403);
    });
});

// ─── GET /api/access-codes/:id ────────────────────────────────────────────────

describe('GET /api/access-codes/:id', () => {
    it.each(['GET', 'HEAD'])(
        '自身の会期トークンで別会期を取得できない (%s)',
        async (method) => {
            const findById = jest
                .fn<IAccessCodeRepository['findById']>()
                .mockResolvedValue(newerAccessCode);
            const app = createTestAppWithAccessCodes(
                createMockAccessCodeRepository({ findById }),
            );
            const response = await app.request(
                `/api/access-codes/${newerAccessCode.id}`,
                {
                    method,
                    headers: {
                        Cookie: `access_token=${userAccessToken}`,
                        'x-event-id': validAccessCode.id,
                    },
                },
                mockEnv,
            );
            expect(response.status).toBe(403);
            expect(findById).not.toHaveBeenCalled();
        },
    );

    const targetId = validAccessCode.id;

    it('有効な access_token（event_id 一致）と x-event-id ヘッダーで 200 と code が返ること', async () => {
        const repo = createMockAccessCodeRepository({
            findById: jest
                .fn<(id: string) => Promise<AccessCode | null>>()
                .mockImplementation(() => Promise.resolve(validAccessCode)),
        });
        const app = createTestAppWithAccessCodes(repo);

        const res = await app.request(
            `/api/access-codes/${targetId}`,
            {
                headers: {
                    Cookie: `access_token=${userAccessToken}`,
                    'x-event-id': targetId,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { code: AccessCode };

        expect(res.status).toBe(200);
        expect(body.code.id).toBe(targetId);
        expect(body.code.eventName).toBe(validAccessCode.eventName);
    });

    it('admin の auth_token で 200 が返ること', async () => {
        const repo = createMockAccessCodeRepository({
            findById: jest
                .fn<(id: string) => Promise<AccessCode | null>>()
                .mockImplementation(() => Promise.resolve(validAccessCode)),
        });
        const app = createTestAppWithAccessCodes(repo);

        const res = await app.request(
            `/api/access-codes/${targetId}`,
            { headers: { Cookie: `auth_token=${adminToken}` } },
            mockEnv,
        );

        expect(res.status).toBe(200);
    });

    it('x-event-id が access_token の event_id と不一致なら 401 が返ること', async () => {
        const app = createTestAppWithAccessCodes(
            createMockAccessCodeRepository(),
        );

        const res = await app.request(
            `/api/access-codes/${targetId}`,
            {
                headers: {
                    Cookie: `access_token=${userAccessToken}`,
                    'x-event-id': '00000000-0000-0000-0000-000000000099', // 別のID
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(401);
    });

    it('Cookie なしで 401 が返ること', async () => {
        const app = createTestAppWithAccessCodes(
            createMockAccessCodeRepository(),
        );

        const res = await app.request(
            `/api/access-codes/${targetId}`,
            {},
            mockEnv,
        );

        expect(res.status).toBe(401);
    });

    it('user ロールの auth_token（access_token なし）では 401 が返ること', async () => {
        const app = createTestAppWithAccessCodes(
            createMockAccessCodeRepository(),
        );

        const res = await app.request(
            `/api/access-codes/${targetId}`,
            { headers: { Cookie: `auth_token=${userToken}` } },
            mockEnv,
        );

        expect(res.status).toBe(401);
    });

    it('存在しない ID で 404 が返ること', async () => {
        const app = createTestAppWithAccessCodes(
            createMockAccessCodeRepository(),
        );

        const res = await app.request(
            `/api/access-codes/${targetId}`,
            {
                headers: {
                    Cookie: `access_token=${userAccessToken}`,
                    'x-event-id': targetId,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { error: string };

        expect(res.status).toBe(404);
        expect(body.error).toBe('アクセスコードが見つかりません');
    });
});
