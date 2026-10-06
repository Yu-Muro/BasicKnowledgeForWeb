import type { Env, R2Bucket } from '@backend/src/db/connection';
import type {
    IShopItemRepository,
    ShopItem,
} from '@backend/src/infrastructure/repositories/shop-item/IShopItemRepository';
import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { sign } from 'hono/jwt';
import { createTestAppWithShopItems } from '../helpers/createTestApp';

const JWT_SECRET = 'test-secret';
const SHOP_ITEM_ASSET_BASE_URL = 'https://assets.example.com';
const mockEnv = {
    JWT_SECRET,
    SHOP_ITEM_ASSET_BASE_URL,
    SHOP_ITEM_ASSET_BUCKET: {} as R2Bucket,
    HYPERDRIVE: { connectionString: '' },
} as unknown as Env;

const EVENT_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_EVENT_ID = '00000000-0000-4000-8000-000000000002';

const shopItem1: ShopItem = {
    id: '40000000-0000-4000-8000-000000000001',
    eventId: EVENT_ID,
    name: 'グッズ A',
    price: 500,
    description: null,
    imageUrl: 'https://assets.example.com/event-1/item-1.webp',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
};

const shopItem2: ShopItem = {
    ...shopItem1,
    id: '40000000-0000-4000-8000-000000000002',
    name: 'グッズ B',
    price: 1000,
    imageUrl: 'https://assets.example.com/event-1/item-2.webp',
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

function createMockShopItemRepository(
    overrides: Partial<IShopItemRepository> = {},
): IShopItemRepository {
    return {
        findByEventId: jest
            .fn<(eventId: string) => Promise<ShopItem[]>>()
            .mockResolvedValue([]),
        search: jest
            .fn<(keyword: string, eventId: string) => Promise<ShopItem[]>>()
            .mockResolvedValue([]),
        create: jest
            .fn<IShopItemRepository['create']>()
            .mockImplementation(() => Promise.resolve(shopItem1)),
        update: jest
            .fn<IShopItemRepository['update']>()
            .mockImplementation(() => Promise.resolve(shopItem1)),
        delete: jest
            .fn<IShopItemRepository['delete']>()
            .mockImplementation(() => Promise.resolve(true)),
        ...overrides,
    };
}

// ─── GET /api/shop-items ──────────────────────────────────────────────────────

describe('GET /api/shop-items', () => {
    it('有効な access_token と一致する x-event-id で 200 と items 配列が返ること', async () => {
        const repo = createMockShopItemRepository({
            findByEventId: jest
                .fn<(eventId: string) => Promise<ShopItem[]>>()
                .mockResolvedValue([shopItem1, shopItem2]),
        });
        const app = createTestAppWithShopItems(repo);

        const res = await app.request(
            '/api/shop-items',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `access_token=${accessToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { items: ShopItem[] };

        expect(res.status).toBe(200);
        expect(body.items).toHaveLength(2);
        expect(body.items[0]?.imageUrl).toBe(shopItem1.imageUrl);
    });

    it('admin の auth_token で 200 が返ること', async () => {
        const repo = createMockShopItemRepository({
            findByEventId: jest
                .fn<(eventId: string) => Promise<ShopItem[]>>()
                .mockResolvedValue([shopItem1]),
        });
        const app = createTestAppWithShopItems(repo);

        const res = await app.request(
            '/api/shop-items',
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
            .fn<(eventId: string) => Promise<ShopItem[]>>()
            .mockImplementation((eventId) =>
                Promise.resolve(
                    eventId === EVENT_ID ? [shopItem1, shopItem2] : [],
                ),
            );
        const app = createTestAppWithShopItems(
            createMockShopItemRepository({ findByEventId }),
        );

        const res = await app.request(
            '/api/shop-items',
            {
                headers: {
                    'x-event-id': OTHER_EVENT_ID,
                    Cookie: `auth_token=${adminToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { items: ShopItem[] };

        expect(res.status).toBe(200);
        expect(body.items).toHaveLength(0);
        expect(findByEventId).toHaveBeenCalledWith(OTHER_EVENT_ID);
    });

    it('認証なしのとき 401 が返ること', async () => {
        const app = createTestAppWithShopItems(createMockShopItemRepository());

        const res = await app.request('/api/shop-items', {
            headers: { 'x-event-id': EVENT_ID },
        });

        expect(res.status).toBe(401);
    });

    it('部署スタッフのセッションでアクセスできること', async () => {
        const app = createTestAppWithShopItems(createMockShopItemRepository());

        const res = await app.request(
            '/api/shop-items',
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
        const app = createTestAppWithShopItems(createMockShopItemRepository());

        const res = await app.request(
            '/api/shop-items',
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
        const app = createTestAppWithShopItems(createMockShopItemRepository());

        const res = await app.request(
            '/api/shop-items',
            { headers: { Cookie: `auth_token=${adminToken}` } },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('x-event-id が UUID でないとき 400 が返ること', async () => {
        const app = createTestAppWithShopItems(createMockShopItemRepository());

        const res = await app.request(
            '/api/shop-items',
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

    it('複数件の販売物が正しく返ること', async () => {
        const repo = createMockShopItemRepository({
            findByEventId: jest
                .fn<(eventId: string) => Promise<ShopItem[]>>()
                .mockResolvedValue([shopItem1, shopItem2]),
        });
        const app = createTestAppWithShopItems(repo);

        const res = await app.request(
            '/api/shop-items',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `access_token=${accessToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { items: ShopItem[] };

        expect(body.items[0]?.name).toBe('グッズ A');
        expect(body.items[1]?.name).toBe('グッズ B');
    });
});

const validShopItemBody = {
    event_id: EVENT_ID,
    name: 'グッズ A',
    price: 500,
    image_key: `shop-items/${EVENT_ID}/uuid.webp`,
};

const SHOP_ITEM_ID = shopItem1.id;

// ─── POST /api/shop-items ─────────────────────────────────────────────────────

describe('POST /api/shop-items', () => {
    it('admin トークンと正しいボディで 201 と item が返ること', async () => {
        const repo = createMockShopItemRepository({
            create: jest
                .fn<IShopItemRepository['create']>()
                .mockImplementation(() => Promise.resolve(shopItem1)),
        });
        const app = createTestAppWithShopItems(repo);

        const res = await app.request(
            '/api/shop-items',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify(validShopItemBody),
            },
            mockEnv,
        );

        expect(res.status).toBe(201);
        const body = (await res.json()) as { item: ShopItem };
        expect(body.item.id).toBe(shopItem1.id);
        expect(repo.create).toHaveBeenCalledWith(
            expect.objectContaining({
                imageKey: validShopItemBody.image_key,
                imageUrl: `${SHOP_ITEM_ASSET_BASE_URL}/${validShopItemBody.image_key}`,
            }),
        );
    });

    it('必須フィールドが欠けている場合は 400 が返ること', async () => {
        const app = createTestAppWithShopItems(createMockShopItemRepository());

        const res = await app.request(
            '/api/shop-items',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ name: 'グッズ' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('body の event_id と x-event-id が不一致のとき 400 が返ること', async () => {
        const app = createTestAppWithShopItems(createMockShopItemRepository());

        const res = await app.request(
            '/api/shop-items',
            {
                method: 'POST',
                headers: {
                    'x-event-id': OTHER_EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify(validShopItemBody),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('認証なしのとき 401 が返ること', async () => {
        const app = createTestAppWithShopItems(createMockShopItemRepository());

        const res = await app.request('/api/shop-items', {
            method: 'POST',
            headers: {
                'x-event-id': EVENT_ID,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(validShopItemBody),
        });

        expect(res.status).toBe(401);
    });

    it('部署スタッフのセッションでアクセスできること', async () => {
        const app = createTestAppWithShopItems(createMockShopItemRepository());

        const res = await app.request(
            '/api/shop-items',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${userToken}`,
                },
                body: JSON.stringify(validShopItemBody),
            },
            mockEnv,
        );

        expect(res.status).toBe(201);
    });
});

// ─── PUT /api/shop-items/:id ──────────────────────────────────────────────────

describe('PUT /api/shop-items/:id', () => {
    it.each(['admin', 'user'])(
        'admin トークンと正しいボディで 200 と更新済み item が返ること（ロール: %s）',
        async (role) => {
            const updated = { ...shopItem1, name: '変更後グッズ' };
            const repo = createMockShopItemRepository({
                update: jest
                    .fn<IShopItemRepository['update']>()
                    .mockImplementation(() => Promise.resolve(updated)),
            });
            const app = createTestAppWithShopItems(repo);

            const res = await app.request(
                `/api/shop-items/${SHOP_ITEM_ID}`,
                {
                    method: 'PUT',
                    headers: {
                        'x-event-id': EVENT_ID,
                        'Content-Type': 'application/json',
                        Cookie: `auth_token=${role === 'admin' ? adminToken : userToken}`,
                    },
                    body: JSON.stringify({ name: '変更後グッズ' }),
                },
                mockEnv,
            );

            expect(res.status).toBe(200);
            const body = (await res.json()) as { item: ShopItem };
            expect(body.item.name).toBe('変更後グッズ');
        },
    );

    it.each(['admin', 'user'])(
        'image_key を更新すると imageUrl も再計算されること（ロール: %s）',
        async (role) => {
            const update = jest
                .fn<IShopItemRepository['update']>()
                .mockImplementation(() =>
                    Promise.resolve({ ...shopItem1, imageUrl: 'placeholder' }),
                );
            const repo = createMockShopItemRepository({ update });
            const app = createTestAppWithShopItems(repo);
            const newKey = `shop-items/${EVENT_ID}/new.webp`;

            const res = await app.request(
                `/api/shop-items/${SHOP_ITEM_ID}`,
                {
                    method: 'PUT',
                    headers: {
                        'x-event-id': EVENT_ID,
                        'Content-Type': 'application/json',
                        Cookie: `auth_token=${role === 'admin' ? adminToken : userToken}`,
                    },
                    body: JSON.stringify({ image_key: newKey }),
                },
                mockEnv,
            );

            expect(res.status).toBe(200);
            expect(update).toHaveBeenCalledWith(
                SHOP_ITEM_ID,
                EVENT_ID,
                expect.objectContaining({
                    imageKey: newKey,
                    imageUrl: `${SHOP_ITEM_ASSET_BASE_URL}/${newKey}`,
                }),
            );
        },
    );

    it('アイテムが存在しない場合は 404 が返ること', async () => {
        const repo = createMockShopItemRepository({
            update: jest
                .fn<IShopItemRepository['update']>()
                .mockImplementation(() => Promise.resolve(null)),
        });
        const app = createTestAppWithShopItems(repo);

        const res = await app.request(
            `/api/shop-items/${SHOP_ITEM_ID}`,
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
        const app = createTestAppWithShopItems(createMockShopItemRepository());

        const res = await app.request(
            '/api/shop-items/not-a-uuid',
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
        const app = createTestAppWithShopItems(createMockShopItemRepository());

        const res = await app.request(`/api/shop-items/${SHOP_ITEM_ID}`, {
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

// ─── DELETE /api/shop-items/:id ───────────────────────────────────────────────

describe('DELETE /api/shop-items/:id', () => {
    it.each(['admin', 'user'])(
        'admin トークンで 200 と削除した id が返ること（ロール: %s）',
        async (role) => {
            const repo = createMockShopItemRepository({
                delete: jest
                    .fn<IShopItemRepository['delete']>()
                    .mockImplementation(() => Promise.resolve(true)),
            });
            const app = createTestAppWithShopItems(repo);

            const res = await app.request(
                `/api/shop-items/${SHOP_ITEM_ID}`,
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
            expect(body.id).toBe(SHOP_ITEM_ID);
        },
    );

    it('アイテムが存在しない場合は 404 が返ること', async () => {
        const repo = createMockShopItemRepository({
            delete: jest
                .fn<IShopItemRepository['delete']>()
                .mockImplementation(() => Promise.resolve(false)),
        });
        const app = createTestAppWithShopItems(repo);

        const res = await app.request(
            `/api/shop-items/${SHOP_ITEM_ID}`,
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
        const app = createTestAppWithShopItems(createMockShopItemRepository());

        const res = await app.request(
            '/api/shop-items/not-a-uuid',
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
        const app = createTestAppWithShopItems(createMockShopItemRepository());

        const res = await app.request(`/api/shop-items/${SHOP_ITEM_ID}`, {
            method: 'DELETE',
            headers: { 'x-event-id': EVENT_ID },
        });

        expect(res.status).toBe(401);
    });
});
