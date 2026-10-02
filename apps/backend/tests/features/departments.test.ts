import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { Env } from '@backend/src/db/connection';
import type {
    Department,
    IDepartmentRepository,
} from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';
import { sign } from 'hono/jwt';
import { createTestAppWithDepartments } from '../helpers/createTestApp';

const JWT_SECRET = 'test-secret';
const mockEnv = { JWT_SECRET } as unknown as Env;

const EVENT_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_EVENT_ID = '00000000-0000-4000-8000-000000000002';

const dept1: Department = {
    id: '60000000-0000-4000-8000-000000000001',
    eventId: EVENT_ID,
    name: '企画部',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
};

const dept2: Department = {
    ...dept1,
    id: '60000000-0000-4000-8000-000000000002',
    name: '運営部',
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

function createMockDepartmentRepository(
    overrides: Partial<IDepartmentRepository> = {},
): IDepartmentRepository {
    return {
        findByEventId: jest
            .fn<(eventId: string) => Promise<Department[]>>()
            .mockResolvedValue([]),
        create: jest
            .fn<IDepartmentRepository['create']>()
            .mockImplementation(() => Promise.resolve(dept1)),
        createBulk: jest
            .fn<IDepartmentRepository['createBulk']>()
            .mockImplementation(() => Promise.resolve([dept1])),
        update: jest
            .fn<IDepartmentRepository['update']>()
            .mockImplementation(() => Promise.resolve(dept1)),
        delete: jest
            .fn<IDepartmentRepository['delete']>()
            .mockImplementation(() => Promise.resolve(true)),
        ...overrides,
    };
}

const DEPT_ID = dept1.id;

// ─── GET /api/departments ─────────────────────────────────────────────────────

describe('GET /api/departments', () => {
    it('有効な access_token と一致する x-event-id で 200 と departments 配列が返ること', async () => {
        const repo = createMockDepartmentRepository({
            findByEventId: jest
                .fn<(eventId: string) => Promise<Department[]>>()
                .mockResolvedValue([dept1, dept2]),
        });
        const app = createTestAppWithDepartments(repo);

        const res = await app.request(
            '/api/departments',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `access_token=${accessToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { departments: Department[] };

        expect(res.status).toBe(200);
        expect(body.departments).toHaveLength(2);
    });

    it('admin の auth_token で 200 が返ること', async () => {
        const repo = createMockDepartmentRepository({
            findByEventId: jest
                .fn<(eventId: string) => Promise<Department[]>>()
                .mockResolvedValue([dept1]),
        });
        const app = createTestAppWithDepartments(repo);

        const res = await app.request(
            '/api/departments',
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
            .fn<(eventId: string) => Promise<Department[]>>()
            .mockImplementation((eventId) =>
                Promise.resolve(eventId === EVENT_ID ? [dept1, dept2] : []),
            );
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository({ findByEventId }),
        );

        const res = await app.request(
            '/api/departments',
            {
                headers: {
                    'x-event-id': OTHER_EVENT_ID,
                    Cookie: `auth_token=${adminToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { departments: Department[] };

        expect(res.status).toBe(200);
        expect(body.departments).toHaveLength(0);
        expect(findByEventId).toHaveBeenCalledWith(OTHER_EVENT_ID);
    });

    it('0 件のとき空配列が返ること', async () => {
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request(
            '/api/departments',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `access_token=${accessToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { departments: Department[] };

        expect(res.status).toBe(200);
        expect(body.departments).toHaveLength(0);
    });

    it('認証なしのとき 401 が返ること', async () => {
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request('/api/departments', {
            headers: { 'x-event-id': EVENT_ID },
        });

        expect(res.status).toBe(401);
    });

    it('role=user の auth_token では 401 が返ること', async () => {
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request(
            '/api/departments',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `auth_token=${userToken}`,
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(401);
    });

    it('access_token の event_id と x-event-id が不一致のとき 401 が返ること', async () => {
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request(
            '/api/departments',
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
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request(
            '/api/departments',
            { headers: { Cookie: `auth_token=${adminToken}` } },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });
});

const validBody = { event_id: EVENT_ID, name: '企画部' };

// ─── POST /api/departments ────────────────────────────────────────────────────

describe('POST /api/departments', () => {
    it('admin トークンと正しいボディで 201 と department が返ること', async () => {
        const repo = createMockDepartmentRepository({
            create: jest
                .fn<IDepartmentRepository['create']>()
                .mockImplementation(() => Promise.resolve(dept1)),
        });
        const app = createTestAppWithDepartments(repo);

        const res = await app.request(
            '/api/departments',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify(validBody),
            },
            mockEnv,
        );

        expect(res.status).toBe(201);
        const body = (await res.json()) as { department: Department };
        expect(body.department.id).toBe(dept1.id);
        expect(body.department.name).toBe('企画部');
    });

    it('name が空のとき 400 が返ること', async () => {
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request(
            '/api/departments',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ event_id: EVENT_ID, name: '' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('body の event_id と x-event-id が不一致のとき 400 が返ること', async () => {
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request(
            '/api/departments',
            {
                method: 'POST',
                headers: {
                    'x-event-id': OTHER_EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify(validBody),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('認証なしのとき 401 が返ること', async () => {
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request('/api/departments', {
            method: 'POST',
            headers: {
                'x-event-id': EVENT_ID,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(validBody),
        });

        expect(res.status).toBe(401);
    });

    it('role=user の auth_token では 403 が返ること', async () => {
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request(
            '/api/departments',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${userToken}`,
                },
                body: JSON.stringify(validBody),
            },
            mockEnv,
        );

        expect(res.status).toBe(403);
    });
});

// ─── POST /api/departments/copy ───────────────────────────────────────────────

describe('POST /api/departments/copy', () => {
    it('コピー元会期の部署名を重複除外してコピーできること', async () => {
        const sourceDepartments: Department[] = [
            {
                ...dept1,
                id: '60000000-0000-4000-8000-000000000010',
                eventId: OTHER_EVENT_ID,
                name: '企画部',
            },
            {
                ...dept1,
                id: '60000000-0000-4000-8000-000000000011',
                eventId: OTHER_EVENT_ID,
                name: '広報部',
            },
        ];
        const createdDepartment: Department = {
            ...dept1,
            id: '60000000-0000-4000-8000-000000000012',
            eventId: EVENT_ID,
            name: '広報部',
        };
        const findByEventId = jest
            .fn<(eventId: string) => Promise<Department[]>>()
            .mockImplementation((eventId) => {
                if (eventId === OTHER_EVENT_ID) {
                    return Promise.resolve(sourceDepartments);
                }
                if (eventId === EVENT_ID) {
                    return Promise.resolve([dept1]);
                }
                return Promise.resolve([]);
            });
        const createBulk = jest
            .fn<IDepartmentRepository['createBulk']>()
            .mockImplementation(() => Promise.resolve([createdDepartment]));
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository({ findByEventId, createBulk }),
        );

        const res = await app.request(
            '/api/departments/copy',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ source_event_id: OTHER_EVENT_ID }),
            },
            mockEnv,
        );
        const body = (await res.json()) as {
            departments: Department[];
            createdCount: number;
            skippedCount: number;
        };

        expect(res.status).toBe(200);
        expect(body.createdCount).toBe(1);
        expect(body.skippedCount).toBe(1);
        expect(body.departments).toHaveLength(1);
        expect(createBulk).toHaveBeenCalledWith([
            {
                eventId: EVENT_ID,
                name: '広報部',
            },
        ]);
    });

    it('コピー元とコピー先が同一会期のとき 400 が返ること', async () => {
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request(
            '/api/departments/copy',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ source_event_id: EVENT_ID }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('コピー元会期に部署がないとき 404 が返ること', async () => {
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request(
            '/api/departments/copy',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ source_event_id: OTHER_EVENT_ID }),
            },
            mockEnv,
        );

        expect(res.status).toBe(404);
    });

    it('source_event_id が不正なとき 400 が返ること', async () => {
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request(
            '/api/departments/copy',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ source_event_id: 'invalid' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('role=user の auth_token では 403 が返ること', async () => {
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request(
            '/api/departments/copy',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${userToken}`,
                },
                body: JSON.stringify({ source_event_id: OTHER_EVENT_ID }),
            },
            mockEnv,
        );

        expect(res.status).toBe(403);
    });
});

// ─── PUT /api/departments/:id ─────────────────────────────────────────────────

describe('PUT /api/departments/:id', () => {
    it('admin トークンと正しいボディで 200 と更新済み department が返ること', async () => {
        const updated = { ...dept1, name: '変更後部署名' };
        const repo = createMockDepartmentRepository({
            update: jest
                .fn<IDepartmentRepository['update']>()
                .mockImplementation(() => Promise.resolve(updated)),
        });
        const app = createTestAppWithDepartments(repo);

        const res = await app.request(
            `/api/departments/${DEPT_ID}`,
            {
                method: 'PUT',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ name: '変更後部署名' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as { department: Department };
        expect(body.department.name).toBe('変更後部署名');
    });

    it('部署が存在しない場合は 404 が返ること', async () => {
        const repo = createMockDepartmentRepository({
            update: jest
                .fn<IDepartmentRepository['update']>()
                .mockImplementation(() => Promise.resolve(null)),
        });
        const app = createTestAppWithDepartments(repo);

        const res = await app.request(
            `/api/departments/${DEPT_ID}`,
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
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request(
            '/api/departments/not-a-uuid',
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
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request(`/api/departments/${DEPT_ID}`, {
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

// ─── DELETE /api/departments/:id ──────────────────────────────────────────────

describe('DELETE /api/departments/:id', () => {
    it('admin トークンで 200 と削除した id が返ること', async () => {
        const repo = createMockDepartmentRepository({
            delete: jest
                .fn<IDepartmentRepository['delete']>()
                .mockImplementation(() => Promise.resolve(true)),
        });
        const app = createTestAppWithDepartments(repo);

        const res = await app.request(
            `/api/departments/${DEPT_ID}`,
            {
                method: 'DELETE',
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `auth_token=${adminToken}`,
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as { id: string };
        expect(body.id).toBe(DEPT_ID);
    });

    it('部署が存在しない場合は 404 が返ること', async () => {
        const repo = createMockDepartmentRepository({
            delete: jest
                .fn<IDepartmentRepository['delete']>()
                .mockImplementation(() => Promise.resolve(false)),
        });
        const app = createTestAppWithDepartments(repo);

        const res = await app.request(
            `/api/departments/${DEPT_ID}`,
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

    it('FK 制約違反（部屋割りまたはタイムテーブルで使用中）のとき 409 が返ること', async () => {
        const repo = createMockDepartmentRepository({
            delete: jest
                .fn<IDepartmentRepository['delete']>()
                .mockImplementation(() =>
                    Promise.reject(new Error('foreign key constraint violation')),
                ),
        });
        const app = createTestAppWithDepartments(repo);

        const res = await app.request(
            `/api/departments/${DEPT_ID}`,
            {
                method: 'DELETE',
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `auth_token=${adminToken}`,
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({
            error: 'この部署は部屋割りまたはタイムテーブルで使用されているため削除できません',
        });
    });

    it('不正な UUID のとき 400 が返ること', async () => {
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request(
            '/api/departments/not-a-uuid',
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
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request(`/api/departments/${DEPT_ID}`, {
            method: 'DELETE',
            headers: { 'x-event-id': EVENT_ID },
        });

        expect(res.status).toBe(401);
    });
});
