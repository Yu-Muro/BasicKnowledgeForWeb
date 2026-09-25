import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { Env } from '@backend/src/db/connection';
import type {
    ITimetableRepository,
    TimetableItem,
} from '@backend/src/infrastructure/repositories/timetable/ITimetableRepository';
import { InvalidTimetableDepartmentIdsError } from '@backend/src/infrastructure/repositories/timetable/ITimetableRepository';
import { sign } from 'hono/jwt';
import { createTestAppWithTimetable } from '../helpers/createTestApp';

const JWT_SECRET = 'test-secret';
const mockEnv = { JWT_SECRET } as unknown as Env;

const EVENT_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_EVENT_ID = '00000000-0000-4000-8000-000000000002';
const DEPARTMENT_ID = '20000000-0000-4000-8000-000000000001';

const item1: TimetableItem = {
    id: '10000000-0000-4000-8000-000000000001',
    eventId: EVENT_ID,
    title: '開会式',
    startTime: new Date('2025-08-01T10:00:00Z'),
    endTime: new Date('2025-08-01T11:00:00Z'),
    location: '会場 A',
    description: null,
    isPublic: true,
    departments: [],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
};

const item2: TimetableItem = {
    ...item1,
    id: '10000000-0000-4000-8000-000000000002',
    title: '○○企画',
    startTime: new Date('2025-08-01T11:00:00Z'),
    endTime: new Date('2025-08-01T12:00:00Z'),
    location: '会場 B',
};

let accessToken: string;
let adminToken: string;
let userToken: string;

beforeAll(async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    accessToken = await sign({ event_id: EVENT_ID, exp }, JWT_SECRET);
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

function createMockTimetableRepository(
    overrides: Partial<ITimetableRepository> = {},
): ITimetableRepository {
    return {
        findByEventId: jest
            .fn<(eventId: string) => Promise<TimetableItem[]>>()
            .mockResolvedValue([]),
        findById: jest
            .fn<ITimetableRepository['findById']>()
            .mockImplementation(() => Promise.resolve(item1)),
        search: jest
            .fn<
                (keyword: string, eventId: string) => Promise<TimetableItem[]>
            >()
            .mockResolvedValue([]),
        create: jest
            .fn<ITimetableRepository['create']>()
            .mockImplementation(() => Promise.resolve(item1)),
        update: jest
            .fn<ITimetableRepository['update']>()
            .mockImplementation(() => Promise.resolve(item1)),
        delete: jest
            .fn<ITimetableRepository['delete']>()
            .mockImplementation(() => Promise.resolve(true)),
        ...overrides,
    };
}

// ─── GET /api/timetable ───────────────────────────────────────────────────────

describe('GET /api/timetable', () => {
    it('有効な access_token と一致する x-event-id で 200 と items 配列が返ること', async () => {
        const repo = createMockTimetableRepository({
            findByEventId: jest
                .fn<(eventId: string) => Promise<TimetableItem[]>>()
                .mockResolvedValue([item1, item2]),
        });
        const app = createTestAppWithTimetable(repo);

        const res = await app.request(
            '/api/timetable',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `access_token=${accessToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { items: TimetableItem[] };

        expect(res.status).toBe(200);
        expect(body.items).toHaveLength(2);
    });

    it('admin の auth_token で 200 が返ること', async () => {
        const repo = createMockTimetableRepository({
            findByEventId: jest
                .fn<(eventId: string) => Promise<TimetableItem[]>>()
                .mockResolvedValue([item1]),
        });
        const app = createTestAppWithTimetable(repo);

        const res = await app.request(
            '/api/timetable',
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
            .fn<(eventId: string) => Promise<TimetableItem[]>>()
            .mockImplementation((eventId) =>
                Promise.resolve(
                    eventId === EVENT_ID ? [item1, item2] : [],
                ),
            );
        const app = createTestAppWithTimetable(
            createMockTimetableRepository({ findByEventId }),
        );

        const res = await app.request(
            '/api/timetable',
            {
                headers: {
                    'x-event-id': OTHER_EVENT_ID,
                    Cookie: `auth_token=${adminToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { items: TimetableItem[] };

        expect(res.status).toBe(200);
        expect(body.items).toHaveLength(0);
        expect(findByEventId).toHaveBeenCalledWith(OTHER_EVENT_ID);
    });

    it('start_time 昇順で返ること', async () => {
        const repo = createMockTimetableRepository({
            findByEventId: jest
                .fn<(eventId: string) => Promise<TimetableItem[]>>()
                .mockResolvedValue([item1, item2]),
        });
        const app = createTestAppWithTimetable(repo);

        const res = await app.request(
            '/api/timetable',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `access_token=${accessToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { items: TimetableItem[] };

        expect(body.items[0]?.id).toBe(item1.id);
        expect(body.items[1]?.id).toBe(item2.id);
    });

    it('認証なしのとき 401 が返ること', async () => {
        const app = createTestAppWithTimetable(createMockTimetableRepository());

        const res = await app.request('/api/timetable', {
            headers: { 'x-event-id': EVENT_ID },
        });

        expect(res.status).toBe(401);
    });

    it('role=user の auth_token では 401 が返ること', async () => {
        const app = createTestAppWithTimetable(createMockTimetableRepository());

        const res = await app.request(
            '/api/timetable',
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
        const app = createTestAppWithTimetable(createMockTimetableRepository());

        const res = await app.request(
            '/api/timetable',
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
        const app = createTestAppWithTimetable(createMockTimetableRepository());

        const res = await app.request(
            '/api/timetable',
            { headers: { Cookie: `auth_token=${adminToken}` } },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('x-event-id が UUID でないとき 400 が返ること', async () => {
        const app = createTestAppWithTimetable(createMockTimetableRepository());

        const res = await app.request(
            '/api/timetable',
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

    it('0 件のとき空配列が返ること', async () => {
        const app = createTestAppWithTimetable(createMockTimetableRepository());

        const res = await app.request(
            '/api/timetable',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `access_token=${accessToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { items: TimetableItem[] };

        expect(res.status).toBe(200);
        expect(body.items).toHaveLength(0);
    });
});

const validBody = {
    event_id: EVENT_ID,
    title: '開会式',
    start_time: '2025-08-01T10:00:00Z',
    location: '会場 A',
};

// ─── POST /api/timetable ──────────────────────────────────────────────────────

describe('POST /api/timetable', () => {
    it('admin トークンと正しいボディで 201 と item が返ること', async () => {
        const repo = createMockTimetableRepository({
            create: jest
                .fn<ITimetableRepository['create']>()
                .mockImplementation(() => Promise.resolve(item1)),
        });
        const app = createTestAppWithTimetable(repo);

        const res = await app.request(
            '/api/timetable',
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
        const body = (await res.json()) as { item: TimetableItem };
        expect(body.item.id).toBe(item1.id);
    });

    it('location なしでも 201 が返り、空文字で保存されること', async () => {
        const created = { ...item1, location: '' };
        const create = jest
            .fn<ITimetableRepository['create']>()
            .mockImplementation(() => Promise.resolve(created));
        const repo = createMockTimetableRepository({ create });
        const app = createTestAppWithTimetable(repo);

        const res = await app.request(
            '/api/timetable',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({
                    event_id: EVENT_ID,
                    title: '開会式',
                    start_time: '2025-08-01T10:00:00Z',
                }),
            },
            mockEnv,
        );

        expect(res.status).toBe(201);
        expect(create).toHaveBeenCalledWith(
            expect.objectContaining({ location: '' }),
        );
    });

    it('全体向けと部署タグを指定して登録できること', async () => {
        const created = {
            ...item1,
            isPublic: false,
            departments: [{ id: DEPARTMENT_ID, name: '広報部' }],
        };
        const create = jest
            .fn<ITimetableRepository['create']>()
            .mockImplementation(() => Promise.resolve(created));
        const repo = createMockTimetableRepository({ create });
        const app = createTestAppWithTimetable(repo);

        const res = await app.request(
            '/api/timetable',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({
                    ...validBody,
                    end_time: '2025-08-01T11:00:00Z',
                    is_public: false,
                    department_ids: [DEPARTMENT_ID],
                }),
            },
            mockEnv,
        );

        expect(res.status).toBe(201);
        expect(create).toHaveBeenCalledWith(
            expect.objectContaining({
                isPublic: false,
                departmentIds: [DEPARTMENT_ID],
            }),
        );
        const body = (await res.json()) as { item: TimetableItem };
        expect(body.item.departments).toHaveLength(1);
    });

    it('全体向けでも部署タグ付きでもない場合は 400 が返ること', async () => {
        const create = jest.fn<ITimetableRepository['create']>();
        const repo = createMockTimetableRepository({ create });
        const app = createTestAppWithTimetable(repo);

        const res = await app.request(
            '/api/timetable',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({
                    ...validBody,
                    is_public: false,
                    department_ids: [],
                }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
        expect(create).not.toHaveBeenCalled();
    });

    it('存在しない部署タグを指定した場合は 400 が返ること', async () => {
        const create = jest
            .fn<ITimetableRepository['create']>()
            .mockImplementation(() =>
                Promise.reject(new InvalidTimetableDepartmentIdsError()),
            );
        const repo = createMockTimetableRepository({ create });
        const app = createTestAppWithTimetable(repo);

        const res = await app.request(
            '/api/timetable',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({
                    ...validBody,
                    is_public: false,
                    department_ids: [DEPARTMENT_ID],
                }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('必須フィールドが欠けている場合は 400 が返ること', async () => {
        const app = createTestAppWithTimetable(createMockTimetableRepository());

        const res = await app.request(
            '/api/timetable',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ title: '開会式' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('body の event_id と x-event-id が不一致のとき 400 が返ること', async () => {
        const app = createTestAppWithTimetable(createMockTimetableRepository());

        const res = await app.request(
            '/api/timetable',
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
        const app = createTestAppWithTimetable(createMockTimetableRepository());

        const res = await app.request(
            '/api/timetable',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(validBody),
            },
        );

        expect(res.status).toBe(401);
    });

    it('role=user の auth_token では 403 が返ること', async () => {
        const app = createTestAppWithTimetable(createMockTimetableRepository());

        const res = await app.request(
            '/api/timetable',
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

// ─── PUT /api/timetable/:id ───────────────────────────────────────────────────

const ITEM_ID = item1.id;

describe('PUT /api/timetable/:id', () => {
    it('admin トークンと正しいボディで 200 と更新済み item が返ること', async () => {
        const updated = { ...item1, title: '変更後タイトル' };
        const repo = createMockTimetableRepository({
            update: jest
                .fn<ITimetableRepository['update']>()
                .mockImplementation(() => Promise.resolve(updated)),
        });
        const app = createTestAppWithTimetable(repo);

        const res = await app.request(
            `/api/timetable/${ITEM_ID}`,
            {
                method: 'PUT',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ title: '変更後タイトル' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as { item: TimetableItem };
        expect(body.item.title).toBe('変更後タイトル');
    });

    it('アイテムが存在しない場合は 404 が返ること', async () => {
        const repo = createMockTimetableRepository({
            update: jest
                .fn<ITimetableRepository['update']>()
                .mockImplementation(() => Promise.resolve(null)),
        });
        const app = createTestAppWithTimetable(repo);

        const res = await app.request(
            `/api/timetable/${ITEM_ID}`,
            {
                method: 'PUT',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ title: '変更' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(404);
    });

    it('不正な UUID のとき 400 が返ること', async () => {
        const app = createTestAppWithTimetable(createMockTimetableRepository());

        const res = await app.request(
            '/api/timetable/not-a-uuid',
            {
                method: 'PUT',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ title: '変更' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('空のボディで 400 が返ること', async () => {
        const app = createTestAppWithTimetable(createMockTimetableRepository());

        const res = await app.request(
            `/api/timetable/${ITEM_ID}`,
            {
                method: 'PUT',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({}),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('部署タグだけを更新できること', async () => {
        const updated = {
            ...item1,
            departments: [{ id: DEPARTMENT_ID, name: '広報部' }],
        };
        const update = jest
            .fn<ITimetableRepository['update']>()
            .mockImplementation(() => Promise.resolve(updated));
        const app = createTestAppWithTimetable(
            createMockTimetableRepository({ update }),
        );

        const res = await app.request(
            `/api/timetable/${ITEM_ID}`,
            {
                method: 'PUT',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ department_ids: [DEPARTMENT_ID] }),
            },
            mockEnv,
        );

        expect(res.status).toBe(200);
        expect(update).toHaveBeenCalledWith(ITEM_ID, EVENT_ID, {
            departmentIds: [DEPARTMENT_ID],
        });
    });

    it('開始時刻だけを既存の終了時刻より後へ更新する場合は 400 が返ること', async () => {
        const update = jest.fn<ITimetableRepository['update']>();
        const app = createTestAppWithTimetable(
            createMockTimetableRepository({ update }),
        );

        const res = await app.request(
            `/api/timetable/${ITEM_ID}`,
            {
                method: 'PUT',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({
                    start_time: '2025-08-01T12:00:00Z',
                }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
        expect(update).not.toHaveBeenCalled();
    });

    it('全体向けでも部署タグ付きでもない更新は 400 が返ること', async () => {
        const update = jest.fn<ITimetableRepository['update']>();
        const app = createTestAppWithTimetable(
            createMockTimetableRepository({ update }),
        );

        const res = await app.request(
            `/api/timetable/${ITEM_ID}`,
            {
                method: 'PUT',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ is_public: false }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
        expect(update).not.toHaveBeenCalled();
    });

    it('更新時に存在しない部署タグを指定した場合は 400 が返ること', async () => {
        const update = jest
            .fn<ITimetableRepository['update']>()
            .mockImplementation(() =>
                Promise.reject(new InvalidTimetableDepartmentIdsError()),
            );
        const app = createTestAppWithTimetable(
            createMockTimetableRepository({ update }),
        );

        const res = await app.request(
            `/api/timetable/${ITEM_ID}`,
            {
                method: 'PUT',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ department_ids: [DEPARTMENT_ID] }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('認証なしのとき 401 が返ること', async () => {
        const app = createTestAppWithTimetable(createMockTimetableRepository());

        const res = await app.request(
            `/api/timetable/${ITEM_ID}`,
            {
                method: 'PUT',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title: '変更' }),
            },
        );

        expect(res.status).toBe(401);
    });
});

// ─── DELETE /api/timetable/:id ────────────────────────────────────────────────

describe('DELETE /api/timetable/:id', () => {
    it('admin トークンで 200 と削除した id が返ること', async () => {
        const repo = createMockTimetableRepository({
            delete: jest
                .fn<ITimetableRepository['delete']>()
                .mockImplementation(() => Promise.resolve(true)),
        });
        const app = createTestAppWithTimetable(repo);

        const res = await app.request(
            `/api/timetable/${ITEM_ID}`,
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
        expect(body.id).toBe(ITEM_ID);
    });

    it('アイテムが存在しない場合は 404 が返ること', async () => {
        const repo = createMockTimetableRepository({
            delete: jest
                .fn<ITimetableRepository['delete']>()
                .mockImplementation(() => Promise.resolve(false)),
        });
        const app = createTestAppWithTimetable(repo);

        const res = await app.request(
            `/api/timetable/${ITEM_ID}`,
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
        const app = createTestAppWithTimetable(createMockTimetableRepository());

        const res = await app.request(
            '/api/timetable/not-a-uuid',
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
        const app = createTestAppWithTimetable(createMockTimetableRepository());

        const res = await app.request(
            `/api/timetable/${ITEM_ID}`,
            {
                method: 'DELETE',
                headers: { 'x-event-id': EVENT_ID },
            },
        );

        expect(res.status).toBe(401);
    });
});
