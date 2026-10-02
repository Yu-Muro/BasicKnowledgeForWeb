import { Hono } from 'hono';
import { describe, expect, it, jest } from '@jest/globals';
import type { Env, R2Bucket } from '@backend/src/db/connection';
import type { ContentEditVariables } from '@backend/src/presentation/middleware/contentEditMiddleware';
import type { AuthUser } from '@backend/src/presentation/middleware/authMiddleware';
import { getTimetableItems, createTimetableItem } from '@backend/src/presentation/controllers/timetableController';
import { createRoom, updateRoom } from '@backend/src/presentation/controllers/roomController';
import { createProgram, deleteProgram } from '@backend/src/presentation/controllers/programController';
import { createShopItem, updateShopItem } from '@backend/src/presentation/controllers/shopItemController';
import { createOtherItem, updateOtherItem } from '@backend/src/presentation/controllers/otherItemController';
import type { IGetTimetableItemsUseCase } from '@backend/src/use-cases/timetable/IGetTimetableItemsUseCase';
import type { ICreateTimetableItemUseCase } from '@backend/src/use-cases/timetable/ICreateTimetableItemUseCase';
import type { ICreateRoomUseCase } from '@backend/src/use-cases/room/ICreateRoomUseCase';
import type { IUpdateRoomUseCase } from '@backend/src/use-cases/room/IUpdateRoomUseCase';
import type { ICreateProgramUseCase } from '@backend/src/use-cases/program/ICreateProgramUseCase';
import type { IDeleteProgramUseCase } from '@backend/src/use-cases/program/IDeleteProgramUseCase';
import type { ICreateShopItemUseCase } from '@backend/src/use-cases/shop-item/ICreateShopItemUseCase';
import type { IUpdateShopItemUseCase } from '@backend/src/use-cases/shop-item/IUpdateShopItemUseCase';
import type { ICreateOtherItemUseCase } from '@backend/src/use-cases/other-item/ICreateOtherItemUseCase';
import type { IUpdateOtherItemUseCase } from '@backend/src/use-cases/other-item/IUpdateOtherItemUseCase';
import type { TimetableItem } from '@backend/src/infrastructure/repositories/timetable/ITimetableRepository';
import type { RoomWithDepartments } from '@backend/src/infrastructure/repositories/room/IRoomRepository';
import type { Program } from '@backend/src/infrastructure/repositories/program/IProgramRepository';
import type { ShopItem } from '@backend/src/infrastructure/repositories/shop-item/IShopItemRepository';
import type { OtherItem } from '@backend/src/infrastructure/repositories/other-item/IOtherItemRepository';

const EVENT_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_EVENT_ID = '00000000-0000-4000-8000-000000000002';

const adminUser: AuthUser = {
    id: '00000000-0000-4000-8000-0000000000aa',
    name: 'Admin',
    email: 'admin@example.com',
    role: 'admin',
};

const mockEnv: Env = {
    HYPERDRIVE: { connectionString: '' },
    JWT_SECRET: 'test-secret',
    SHOP_ITEM_ASSET_BUCKET: {} as R2Bucket,
    SHOP_ITEM_ASSET_BASE_URL: 'https://assets.example.com',
};

const timetableItems: TimetableItem[] = [
    {
        id: '10000000-0000-4000-8000-000000000000',
        eventId: EVENT_ID,
        title: '開会式',
        startTime: new Date(),
        endTime: new Date(),
        location: '会場A',
        description: null,
        isPublic: true,
        departments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
    },
];

const room: RoomWithDepartments = {
    id: '20000000-0000-4000-8000-000000000000',
    eventId: EVENT_ID,
    buildingName: 'A棟',
    floor: '1F',
    roomName: '本部',
    preDayManagerId: null,
    preDayManagerName: null,
    preDayPurpose: null,
    dayManagerId: '60000000-0000-4000-8000-000000000000',
    dayManagerName: '運営部',
    dayPurpose: '受付',
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
};

const program: Program = {
    id: '30000000-0000-4000-8000-000000000000',
    eventId: EVENT_ID,
    name: '企画A',
    location: 'ホール',
    startTime: new Date(),
    endTime: new Date(),
    description: null,
    imageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
};

const shopItem: ShopItem = {
    id: '40000000-0000-4000-8000-000000000000',
    eventId: EVENT_ID,
    name: 'グッズA',
    price: 500,
    description: null,
    imageUrl: 'https://assets.example.com/a.webp',
    createdAt: new Date(),
    updatedAt: new Date(),
};

const otherItem: OtherItem = {
    id: '50000000-0000-4000-8000-000000000000',
    eventId: EVENT_ID,
    title: '注意事項',
    content: '集合時間は9時です',
    imageUrl: null,
    displayOrder: 1,
    createdBy: adminUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
};

function createAdminApp() {
    const app = new Hono<{ Bindings: Env; Variables: ContentEditVariables }>();
    app.use('*', async (c, next) => {
        c.set('eventId', EVENT_ID);
        c.set('user', adminUser);
        await next();
    });
    return app;
}

// Timetable controller

describe('timetableController', () => {
    it('getTimetableItems returns 200 with payload', async () => {
        const useCase: IGetTimetableItemsUseCase = {
            execute: jest
                .fn<IGetTimetableItemsUseCase['execute']>()
                .mockResolvedValue({ success: true, data: timetableItems }),
        };
        const app = new Hono();
        app.get('/timetable', (c) => getTimetableItems(c, useCase));

        const res = await app.request('/timetable', {
            headers: { 'x-event-id': EVENT_ID },
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as { items: TimetableItem[] };
        expect(body.items).toHaveLength(1);
    });

    it('createTimetableItem rejects event_id mismatch', async () => {
        const useCase: ICreateTimetableItemUseCase = {
            execute: jest
                .fn<ICreateTimetableItemUseCase['execute']>()
                .mockResolvedValue({ success: true, data: timetableItems[0] }),
        };
        const app = createAdminApp();
        app.post('/timetable', (c) => createTimetableItem(c, useCase));

        const res = await app.request(
            '/timetable',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-event-id': EVENT_ID,
                },
                body: JSON.stringify({
                    event_id: OTHER_EVENT_ID,
                    title: '開会式',
                    start_time: '2025-08-01T10:00:00.000Z',
                    location: '会場A',
                }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
        expect(useCase.execute).not.toHaveBeenCalled();
    });
});

// Room controller

describe('roomController', () => {
    it('createRoom returns 201 on success', async () => {
        const useCase: ICreateRoomUseCase = {
            execute: jest
                .fn<ICreateRoomUseCase['execute']>()
                .mockResolvedValue({ success: true, data: room }),
        };
        const app = createAdminApp();
        app.post('/rooms', (c) => createRoom(c, useCase));

        const res = await app.request(
            '/rooms',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-event-id': EVENT_ID,
                },
                body: JSON.stringify({
                    event_id: EVENT_ID,
                    building_name: 'A棟',
                    floor: '1F',
                    room_name: '本部',
                    day_manager_id: room.dayManagerId,
                    day_purpose: '受付',
                }),
            },
            mockEnv,
        );

        const body = (await res.json()) as { room: RoomWithDepartments };
        expect(res.status).toBe(201);
        expect(body.room.roomName).toBe('本部');
    });

    it('updateRoom rejects non UUID id', async () => {
        const useCase: IUpdateRoomUseCase = {
            execute: jest
                .fn<IUpdateRoomUseCase['execute']>()
                .mockResolvedValue({ success: true, data: room }),
        };
        const app = createAdminApp();
        app.put('/rooms/:id', (c) => updateRoom(c, useCase));

        const res = await app.request(
            '/rooms/not-uuid',
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-event-id': EVENT_ID,
                },
                body: JSON.stringify({ building_name: 'A棟' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
        expect(useCase.execute).not.toHaveBeenCalled();
    });
});

// Program controller

describe('programController', () => {
    it('createProgram returns 201 on success', async () => {
        const useCase: ICreateProgramUseCase = {
            execute: jest
                .fn<ICreateProgramUseCase['execute']>()
                .mockResolvedValue({ success: true, data: program }),
        };
        const app = createAdminApp();
        app.post('/programs', (c) => createProgram(c, useCase));

        const res = await app.request(
            '/programs',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-event-id': EVENT_ID,
                },
                body: JSON.stringify({
                    event_id: EVENT_ID,
                    name: '企画A',
                    location: 'ホール',
                    start_time: '2025-08-01T12:00:00.000Z',
                    end_time: '2025-08-01T13:00:00.000Z',
                }),
            },
            mockEnv,
        );

        expect(res.status).toBe(201);
    });

    it('deleteProgram surfaces use case error status', async () => {
        const useCase: IDeleteProgramUseCase = {
            execute: jest.fn<IDeleteProgramUseCase['execute']>().mockResolvedValue({
                success: false,
                error: 'not-found',
                status: 404,
            }),
        };
        const app = createAdminApp();
        app.delete('/programs/:id', (c) => deleteProgram(c, useCase));

        const res = await app.request(
            `/programs/${program.id}`,
            {
                method: 'DELETE',
                headers: { 'x-event-id': EVENT_ID },
            },
            mockEnv,
        );

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'not-found' });
    });
});

// Shop item controller

describe('shopItemController', () => {
    it('createShopItem validates body', async () => {
        const useCase: ICreateShopItemUseCase = {
            execute: jest
                .fn<ICreateShopItemUseCase['execute']>()
                .mockResolvedValue({ success: true, data: shopItem }),
        };
        const app = createAdminApp();
        app.post('/shop-items', (c) => createShopItem(c, useCase));

        const res = await app.request(
            '/shop-items',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-event-id': EVENT_ID,
                },
                body: JSON.stringify({ name: 'invalid' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
        expect(useCase.execute).not.toHaveBeenCalled();
    });

    it('updateShopItem returns 200 on success', async () => {
        const updated = { ...shopItem, name: '変更後' };
        const useCase: IUpdateShopItemUseCase = {
            execute: jest
                .fn<IUpdateShopItemUseCase['execute']>()
                .mockResolvedValue({ success: true, data: updated }),
        };
        const app = createAdminApp();
        app.put('/shop-items/:id', (c) => updateShopItem(c, useCase));

        const res = await app.request(
            `/shop-items/${shopItem.id}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-event-id': EVENT_ID,
                },
                body: JSON.stringify({ name: '変更後' }),
            },
            mockEnv,
        );

        const body = (await res.json()) as { item: ShopItem };
        expect(res.status).toBe(200);
        expect(body.item.name).toBe('変更後');
    });
});

// Other item controller

describe('otherItemController', () => {
    it('createOtherItem forwards user id as createdBy', async () => {
        const useCase: ICreateOtherItemUseCase = {
            execute: jest
                .fn<ICreateOtherItemUseCase['execute']>()
                .mockResolvedValue({ success: true, data: otherItem }),
        };
        const app = createAdminApp();
        app.post('/others', (c) => createOtherItem(c, useCase));

        const res = await app.request(
            '/others',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-event-id': EVENT_ID,
                },
                body: JSON.stringify({
                    event_id: EVENT_ID,
                    title: '注意事項',
                    content: '集合時間は9時です',
                    display_order: 1,
                }),
            },
            mockEnv,
        );

        expect(res.status).toBe(201);
        expect(useCase.execute).toHaveBeenCalledWith({
            eventId: EVENT_ID,
            title: '注意事項',
            content: '集合時間は9時です',
            displayOrder: 1,
            createdBy: adminUser.id,
        });
    });

    it('updateOtherItem validates id format', async () => {
        const useCase: IUpdateOtherItemUseCase = {
            execute: jest
                .fn<IUpdateOtherItemUseCase['execute']>()
                .mockResolvedValue({ success: true, data: otherItem }),
        };
        const app = createAdminApp();
        app.put('/others/:id', (c) => updateOtherItem(c, useCase));

        const res = await app.request(
            '/others/not-uuid',
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-event-id': EVENT_ID,
                },
                body: JSON.stringify({ title: '更新' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
        expect(useCase.execute).not.toHaveBeenCalled();
    });
});
