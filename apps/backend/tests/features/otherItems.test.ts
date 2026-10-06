import type { Env } from '@backend/src/db/connection';
import type {
    IOtherItemRepository,
    OtherItem,
} from '@backend/src/infrastructure/repositories/other-item/IOtherItemRepository';
import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { sign } from 'hono/jwt';
import { createTestAppWithOtherItems } from '../helpers/createTestApp';

const JWT_SECRET = 'test-secret';
const mockEnv = { JWT_SECRET } as unknown as Env;

const EVENT_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_EVENT_ID = '00000000-0000-4000-8000-000000000002';

const otherItem1: OtherItem = {
    id: '50000000-0000-4000-8000-000000000001',
    eventId: EVENT_ID,
    title: '注意事項',
    content: '当日の持ち物について...',
    imageUrl: null,
    displayOrder: 1,
    createdBy: '00000000-0000-0000-0000-000000000099',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
};

const otherItem2: OtherItem = {
    ...otherItem1,
    id: '50000000-0000-4000-8000-000000000002',
    title: '緊急連絡先',
    content: '責任者: 090-XXXX-XXXX',
    displayOrder: 2,
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

function createMockOtherItemRepository(
    overrides: Partial<IOtherItemRepository> = {},
): IOtherItemRepository {
    return {
        findByEventId: jest
            .fn<(eventId: string) => Promise<OtherItem[]>>()
            .mockResolvedValue([]),
        search: jest
            .fn<(keyword: string, eventId: string) => Promise<OtherItem[]>>()
            .mockResolvedValue([]),
        create: jest
            .fn<IOtherItemRepository['create']>()
            .mockImplementation(() => Promise.resolve(otherItem1)),
        update: jest
            .fn<IOtherItemRepository['update']>()
            .mockImplementation(() => Promise.resolve(otherItem1)),
        delete: jest
            .fn<IOtherItemRepository['delete']>()
            .mockImplementation(() => Promise.resolve(true)),
        ...overrides,
    };
}

// ─── GET /api/others ──────────────────────────────────────────────────────────

describe('GET /api/others', () => {
    it('有効な access_token と一致する x-event-id で 200 と items 配列が返ること', async () => {
        const repo = createMockOtherItemRepository({
            findByEventId: jest
                .fn<(eventId: string) => Promise<OtherItem[]>>()
                .mockResolvedValue([otherItem1, otherItem2]),
        });
        const app = createTestAppWithOtherItems(repo);

        const res = await app.request(
            '/api/others',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `access_token=${accessToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { items: OtherItem[] };

        expect(res.status).toBe(200);
        expect(body.items).toHaveLength(2);
    });

    it('admin の auth_token で 200 が返ること', async () => {
        const repo = createMockOtherItemRepository({
            findByEventId: jest
                .fn<(eventId: string) => Promise<OtherItem[]>>()
                .mockResolvedValue([otherItem1]),
        });
        const app = createTestAppWithOtherItems(repo);

        const res = await app.request(
            '/api/others',
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
            .fn<(eventId: string) => Promise<OtherItem[]>>()
            .mockImplementation((eventId) =>
                Promise.resolve(
                    eventId === EVENT_ID ? [otherItem1, otherItem2] : [],
                ),
            );
        const app = createTestAppWithOtherItems(
            createMockOtherItemRepository({ findByEventId }),
        );

        const res = await app.request(
            '/api/others',
            {
                headers: {
                    'x-event-id': OTHER_EVENT_ID,
                    Cookie: `auth_token=${adminToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { items: OtherItem[] };

        expect(res.status).toBe(200);
        expect(body.items).toHaveLength(0);
        expect(findByEventId).toHaveBeenCalledWith(OTHER_EVENT_ID);
    });

    it('display_order 昇順で返ること', async () => {
        const repo = createMockOtherItemRepository({
            findByEventId: jest
                .fn<(eventId: string) => Promise<OtherItem[]>>()
                .mockResolvedValue([otherItem1, otherItem2]),
        });
        const app = createTestAppWithOtherItems(repo);

        const res = await app.request(
            '/api/others',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `access_token=${accessToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { items: OtherItem[] };

        expect(body.items[0]?.displayOrder).toBe(1);
        expect(body.items[1]?.displayOrder).toBe(2);
    });

    it('認証なしのとき 401 が返ること', async () => {
        const app = createTestAppWithOtherItems(
            createMockOtherItemRepository(),
        );

        const res = await app.request('/api/others', {
            headers: { 'x-event-id': EVENT_ID },
        });

        expect(res.status).toBe(401);
    });

    it('部署スタッフのセッションでアクセスできること', async () => {
        const app = createTestAppWithOtherItems(
            createMockOtherItemRepository(),
        );

        const res = await app.request(
            '/api/others',
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
        const app = createTestAppWithOtherItems(
            createMockOtherItemRepository(),
        );

        const res = await app.request(
            '/api/others',
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
        const app = createTestAppWithOtherItems(
            createMockOtherItemRepository(),
        );

        const res = await app.request(
            '/api/others',
            { headers: { Cookie: `auth_token=${adminToken}` } },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('x-event-id が UUID でないとき 400 が返ること', async () => {
        const app = createTestAppWithOtherItems(
            createMockOtherItemRepository(),
        );

        const res = await app.request(
            '/api/others',
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
        const app = createTestAppWithOtherItems(
            createMockOtherItemRepository(),
        );

        const res = await app.request(
            '/api/others',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `access_token=${accessToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { items: OtherItem[] };

        expect(res.status).toBe(200);
        expect(body.items).toHaveLength(0);
    });
});

const validOtherItemBody = {
    event_id: EVENT_ID,
    title: '注意事項',
    content: '当日の持ち物について...',
    display_order: 1,
};

const OTHER_ITEM_ID = otherItem1.id;

// ─── POST /api/others ─────────────────────────────────────────────────────────

describe('POST /api/others', () => {
    it('admin トークンと正しいボディで 201 と item が返ること', async () => {
        const repo = createMockOtherItemRepository({
            create: jest
                .fn<IOtherItemRepository['create']>()
                .mockImplementation(() => Promise.resolve(otherItem1)),
        });
        const app = createTestAppWithOtherItems(repo);

        const res = await app.request(
            '/api/others',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify(validOtherItemBody),
            },
            mockEnv,
        );

        expect(res.status).toBe(201);
        const body = (await res.json()) as { item: OtherItem };
        expect(body.item.id).toBe(otherItem1.id);
    });

    it('必須フィールドが欠けている場合は 400 が返ること', async () => {
        const app = createTestAppWithOtherItems(
            createMockOtherItemRepository(),
        );

        const res = await app.request(
            '/api/others',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ title: '注意事項' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('body の event_id と x-event-id が不一致のとき 400 が返ること', async () => {
        const app = createTestAppWithOtherItems(
            createMockOtherItemRepository(),
        );

        const res = await app.request(
            '/api/others',
            {
                method: 'POST',
                headers: {
                    'x-event-id': OTHER_EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify(validOtherItemBody),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('認証なしのとき 401 が返ること', async () => {
        const app = createTestAppWithOtherItems(
            createMockOtherItemRepository(),
        );

        const res = await app.request('/api/others', {
            method: 'POST',
            headers: {
                'x-event-id': EVENT_ID,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(validOtherItemBody),
        });

        expect(res.status).toBe(401);
    });

    it('部署スタッフのセッションでアクセスできること', async () => {
        const app = createTestAppWithOtherItems(
            createMockOtherItemRepository(),
        );

        const res = await app.request(
            '/api/others',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${userToken}`,
                },
                body: JSON.stringify(validOtherItemBody),
            },
            mockEnv,
        );

        expect(res.status).toBe(201);
    });
});

// ─── PUT /api/others/:id ──────────────────────────────────────────────────────

describe('PUT /api/others/:id', () => {
    it.each(['admin', 'user'])(
        'admin トークンと正しいボディで 200 と更新済み item が返ること（ロール: %s）',
        async (role) => {
            const updated = { ...otherItem1, title: '変更後タイトル' };
            const repo = createMockOtherItemRepository({
                update: jest
                    .fn<IOtherItemRepository['update']>()
                    .mockImplementation(() => Promise.resolve(updated)),
            });
            const app = createTestAppWithOtherItems(repo);

            const res = await app.request(
                `/api/others/${OTHER_ITEM_ID}`,
                {
                    method: 'PUT',
                    headers: {
                        'x-event-id': EVENT_ID,
                        'Content-Type': 'application/json',
                        Cookie: `auth_token=${role === 'admin' ? adminToken : userToken}`,
                    },
                    body: JSON.stringify({ title: '変更後タイトル' }),
                },
                mockEnv,
            );

            expect(res.status).toBe(200);
            const body = (await res.json()) as { item: OtherItem };
            expect(body.item.title).toBe('変更後タイトル');
        },
    );

    it('アイテムが存在しない場合は 404 が返ること', async () => {
        const repo = createMockOtherItemRepository({
            update: jest
                .fn<IOtherItemRepository['update']>()
                .mockImplementation(() => Promise.resolve(null)),
        });
        const app = createTestAppWithOtherItems(repo);

        const res = await app.request(
            `/api/others/${OTHER_ITEM_ID}`,
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
        const app = createTestAppWithOtherItems(
            createMockOtherItemRepository(),
        );

        const res = await app.request(
            '/api/others/not-a-uuid',
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

    it('認証なしのとき 401 が返ること', async () => {
        const app = createTestAppWithOtherItems(
            createMockOtherItemRepository(),
        );

        const res = await app.request(`/api/others/${OTHER_ITEM_ID}`, {
            method: 'PUT',
            headers: {
                'x-event-id': EVENT_ID,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title: '変更' }),
        });

        expect(res.status).toBe(401);
    });
});

// ─── DELETE /api/others/:id ───────────────────────────────────────────────────

describe('DELETE /api/others/:id', () => {
    it.each(['admin', 'user'])(
        'admin トークンで 200 と削除した id が返ること（ロール: %s）',
        async (role) => {
            const repo = createMockOtherItemRepository({
                delete: jest
                    .fn<IOtherItemRepository['delete']>()
                    .mockImplementation(() => Promise.resolve(true)),
            });
            const app = createTestAppWithOtherItems(repo);

            const res = await app.request(
                `/api/others/${OTHER_ITEM_ID}`,
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
            expect(body.id).toBe(OTHER_ITEM_ID);
        },
    );

    it('アイテムが存在しない場合は 404 が返ること', async () => {
        const repo = createMockOtherItemRepository({
            delete: jest
                .fn<IOtherItemRepository['delete']>()
                .mockImplementation(() => Promise.resolve(false)),
        });
        const app = createTestAppWithOtherItems(repo);

        const res = await app.request(
            `/api/others/${OTHER_ITEM_ID}`,
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
        const app = createTestAppWithOtherItems(
            createMockOtherItemRepository(),
        );

        const res = await app.request(
            '/api/others/not-a-uuid',
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
        const app = createTestAppWithOtherItems(
            createMockOtherItemRepository(),
        );

        const res = await app.request(`/api/others/${OTHER_ITEM_ID}`, {
            method: 'DELETE',
            headers: { 'x-event-id': EVENT_ID },
        });

        expect(res.status).toBe(401);
    });
});
