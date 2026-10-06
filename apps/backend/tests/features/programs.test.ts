import type { Env } from '@backend/src/db/connection';
import type {
    IProgramRepository,
    Program,
} from '@backend/src/infrastructure/repositories/program/IProgramRepository';
import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { sign } from 'hono/jwt';
import { createTestAppWithPrograms } from '../helpers/createTestApp';

const JWT_SECRET = 'test-secret';
const mockEnv = { JWT_SECRET } as unknown as Env;

const EVENT_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_EVENT_ID = '00000000-0000-4000-8000-000000000002';

const program1: Program = {
    id: '30000000-0000-4000-8000-000000000001',
    eventId: EVENT_ID,
    name: '○○サークル展示',
    location: '会場 A',
    startTime: new Date('2025-08-01T10:00:00Z'),
    endTime: new Date('2025-08-01T12:00:00Z'),
    description: '説明テキスト',
    imageUrl: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
};

const program2: Program = {
    ...program1,
    id: '30000000-0000-4000-8000-000000000002',
    name: '△△サークル展示',
    startTime: new Date('2025-08-01T13:00:00Z'),
    endTime: new Date('2025-08-01T15:00:00Z'),
};

let accessToken: string;
let adminToken: string;
let userToken: string;

beforeAll(async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    accessToken = await sign({ event_id: EVENT_ID, exp }, JWT_SECRET);
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
});

function createMockProgramRepository(
    overrides: Partial<IProgramRepository> = {},
): IProgramRepository {
    return {
        findByEventId: jest
            .fn<(eventId: string) => Promise<Program[]>>()
            .mockResolvedValue([]),
        findById: jest
            .fn<IProgramRepository['findById']>()
            .mockImplementation(() => Promise.resolve(program1)),
        search: jest
            .fn<(keyword: string, eventId: string) => Promise<Program[]>>()
            .mockResolvedValue([]),
        create: jest
            .fn<IProgramRepository['create']>()
            .mockImplementation(() => Promise.resolve(program1)),
        update: jest
            .fn<IProgramRepository['update']>()
            .mockImplementation(() => Promise.resolve(program1)),
        delete: jest
            .fn<IProgramRepository['delete']>()
            .mockImplementation(() => Promise.resolve(true)),
        ...overrides,
    };
}

// ─── GET /api/programs ────────────────────────────────────────────────────────

describe('GET /api/programs', () => {
    it('有効な access_token と一致する x-event-id で 200 と programs 配列が返ること', async () => {
        const repo = createMockProgramRepository({
            findByEventId: jest
                .fn<(eventId: string) => Promise<Program[]>>()
                .mockResolvedValue([program1, program2]),
        });
        const app = createTestAppWithPrograms(repo);

        const res = await app.request(
            '/api/programs',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `access_token=${accessToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { programs: Program[] };

        expect(res.status).toBe(200);
        expect(body.programs).toHaveLength(2);
    });

    it('admin の auth_token で 200 が返ること', async () => {
        const repo = createMockProgramRepository({
            findByEventId: jest
                .fn<(eventId: string) => Promise<Program[]>>()
                .mockResolvedValue([program1]),
        });
        const app = createTestAppWithPrograms(repo);

        const res = await app.request(
            '/api/programs',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `auth_token=${adminToken}`,
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(200);
    });

    it('x-event-id でフィルタリングされること', async () => {
        const findByEventId = jest
            .fn<(eventId: string) => Promise<Program[]>>()
            .mockImplementation((eventId) =>
                Promise.resolve(
                    eventId === EVENT_ID ? [program1, program2] : [],
                ),
            );
        const app = createTestAppWithPrograms(
            createMockProgramRepository({ findByEventId }),
        );

        const res = await app.request(
            '/api/programs',
            {
                headers: {
                    'x-event-id': OTHER_EVENT_ID,
                    Cookie: `auth_token=${adminToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { programs: Program[] };

        expect(res.status).toBe(200);
        expect(body.programs).toHaveLength(0);
        expect(findByEventId).toHaveBeenCalledWith(OTHER_EVENT_ID);
    });

    it('start_time 昇順で返ること', async () => {
        const repo = createMockProgramRepository({
            findByEventId: jest
                .fn<(eventId: string) => Promise<Program[]>>()
                .mockResolvedValue([program1, program2]),
        });
        const app = createTestAppWithPrograms(repo);

        const res = await app.request(
            '/api/programs',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `access_token=${accessToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { programs: Program[] };

        expect(body.programs[0]?.id).toBe(program1.id);
        expect(body.programs[1]?.id).toBe(program2.id);
    });

    it('認証なしのとき 401 が返ること', async () => {
        const app = createTestAppWithPrograms(createMockProgramRepository());

        const res = await app.request('/api/programs', {
            headers: { 'x-event-id': EVENT_ID },
        });

        expect(res.status).toBe(401);
    });

    it('部署スタッフのセッションでアクセスできること', async () => {
        const app = createTestAppWithPrograms(createMockProgramRepository());

        const res = await app.request(
            '/api/programs',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `auth_token=${userToken}`,
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(200);
    });

    it('access_token の event_id と x-event-id が不一致のとき 401 が返ること', async () => {
        const app = createTestAppWithPrograms(createMockProgramRepository());

        const res = await app.request(
            '/api/programs',
            {
                headers: {
                    'x-event-id': OTHER_EVENT_ID,
                    Cookie: `access_token=${accessToken}`,
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(401);
    });

    it('x-event-id ヘッダーが未指定のとき 400 が返ること', async () => {
        const app = createTestAppWithPrograms(createMockProgramRepository());

        const res = await app.request(
            '/api/programs',
            { headers: { Cookie: `auth_token=${adminToken}` } },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('x-event-id が UUID でないとき 400 が返ること', async () => {
        const app = createTestAppWithPrograms(createMockProgramRepository());

        const res = await app.request(
            '/api/programs',
            {
                headers: {
                    'x-event-id': 'not-a-uuid',
                    Cookie: `auth_token=${adminToken}`,
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });
});

const validProgramBody = {
    event_id: EVENT_ID,
    name: '○○企画',
    location: '会場 A',
    start_time: '2025-08-01T10:00:00Z',
    end_time: '2025-08-01T12:00:00Z',
};

const PROGRAM_ID = program1.id;

// ─── POST /api/programs ───────────────────────────────────────────────────────

describe('POST /api/programs', () => {
    it('admin トークンと正しいボディで 201 と program が返ること', async () => {
        const repo = createMockProgramRepository({
            create: jest
                .fn<IProgramRepository['create']>()
                .mockImplementation(() => Promise.resolve(program1)),
        });
        const app = createTestAppWithPrograms(repo);

        const res = await app.request(
            '/api/programs',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify(validProgramBody),
            },
            mockEnv,
        );

        expect(res.status).toBe(201);
        const body = (await res.json()) as { program: Program };
        expect(body.program.id).toBe(program1.id);
    });

    it('必須フィールドが欠けている場合は 400 が返ること', async () => {
        const app = createTestAppWithPrograms(createMockProgramRepository());

        const res = await app.request(
            '/api/programs',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ name: '企画' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('body の event_id と x-event-id が不一致のとき 400 が返ること', async () => {
        const app = createTestAppWithPrograms(createMockProgramRepository());

        const res = await app.request(
            '/api/programs',
            {
                method: 'POST',
                headers: {
                    'x-event-id': OTHER_EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify(validProgramBody),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('認証なしのとき 401 が返ること', async () => {
        const app = createTestAppWithPrograms(createMockProgramRepository());

        const res = await app.request('/api/programs', {
            method: 'POST',
            headers: {
                'x-event-id': EVENT_ID,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(validProgramBody),
        });

        expect(res.status).toBe(401);
    });

    it('部署スタッフのセッションでアクセスできること', async () => {
        const app = createTestAppWithPrograms(createMockProgramRepository());

        const res = await app.request(
            '/api/programs',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${userToken}`,
                },
                body: JSON.stringify(validProgramBody),
            },
            mockEnv,
        );

        expect(res.status).toBe(201);
    });
});

// ─── PUT /api/programs/:id ────────────────────────────────────────────────────

describe('PUT /api/programs/:id', () => {
    it.each(['admin', 'user'])(
        'admin トークンと正しいボディで 200 と更新済み program が返ること（ロール: %s）',
        async (role) => {
            const updated = { ...program1, name: '変更後企画' };
            const repo = createMockProgramRepository({
                update: jest
                    .fn<IProgramRepository['update']>()
                    .mockImplementation(() => Promise.resolve(updated)),
            });
            const app = createTestAppWithPrograms(repo);

            const res = await app.request(
                `/api/programs/${PROGRAM_ID}`,
                {
                    method: 'PUT',
                    headers: {
                        'x-event-id': EVENT_ID,
                        'Content-Type': 'application/json',
                        Cookie: `auth_token=${role === 'admin' ? adminToken : userToken}`,
                    },
                    body: JSON.stringify({ name: '変更後企画' }),
                },
                mockEnv,
            );

            expect(res.status).toBe(200);
            const body = (await res.json()) as { program: Program };
            expect(body.program.name).toBe('変更後企画');
        },
    );

    it('企画が存在しない場合は 404 が返ること', async () => {
        const repo = createMockProgramRepository({
            update: jest
                .fn<IProgramRepository['update']>()
                .mockImplementation(() => Promise.resolve(null)),
        });
        const app = createTestAppWithPrograms(repo);

        const res = await app.request(
            `/api/programs/${PROGRAM_ID}`,
            {
                method: 'PUT',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ name: '変更' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(404);
    });

    it('不正な UUID のとき 400 が返ること', async () => {
        const app = createTestAppWithPrograms(createMockProgramRepository());

        const res = await app.request(
            '/api/programs/not-a-uuid',
            {
                method: 'PUT',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ name: '変更' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('認証なしのとき 401 が返ること', async () => {
        const app = createTestAppWithPrograms(createMockProgramRepository());

        const res = await app.request(`/api/programs/${PROGRAM_ID}`, {
            method: 'PUT',
            headers: {
                'x-event-id': EVENT_ID,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: '変更' }),
        });

        expect(res.status).toBe(401);
    });
});

// ─── DELETE /api/programs/:id ─────────────────────────────────────────────────

describe('DELETE /api/programs/:id', () => {
    it.each(['admin', 'user'])(
        'admin トークンで 200 と削除した id が返ること（ロール: %s）',
        async (role) => {
            const repo = createMockProgramRepository({
                delete: jest
                    .fn<IProgramRepository['delete']>()
                    .mockImplementation(() => Promise.resolve(true)),
            });
            const app = createTestAppWithPrograms(repo);

            const res = await app.request(
                `/api/programs/${PROGRAM_ID}`,
                {
                    method: 'DELETE',
                    headers: {
                        'x-event-id': EVENT_ID,
                        Cookie: `auth_token=${role === 'admin' ? adminToken : userToken}`,
                    },
                },
                mockEnv,
            );

            expect(res.status).toBe(200);
            const body = (await res.json()) as { id: string };
            expect(body.id).toBe(PROGRAM_ID);
        },
    );

    it('企画が存在しない場合は 404 が返ること', async () => {
        const repo = createMockProgramRepository({
            delete: jest
                .fn<IProgramRepository['delete']>()
                .mockImplementation(() => Promise.resolve(false)),
        });
        const app = createTestAppWithPrograms(repo);

        const res = await app.request(
            `/api/programs/${PROGRAM_ID}`,
            {
                method: 'DELETE',
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `auth_token=${adminToken}`,
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(404);
    });

    it('不正な UUID のとき 400 が返ること', async () => {
        const app = createTestAppWithPrograms(createMockProgramRepository());

        const res = await app.request(
            '/api/programs/not-a-uuid',
            {
                method: 'DELETE',
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `auth_token=${adminToken}`,
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('認証なしのとき 401 が返ること', async () => {
        const app = createTestAppWithPrograms(createMockProgramRepository());

        const res = await app.request(`/api/programs/${PROGRAM_ID}`, {
            method: 'DELETE',
            headers: { 'x-event-id': EVENT_ID },
        });

        expect(res.status).toBe(401);
    });
});
