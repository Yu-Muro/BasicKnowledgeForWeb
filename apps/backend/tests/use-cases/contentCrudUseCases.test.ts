import { describe, expect, it, jest } from '@jest/globals';
import type { Department, IDepartmentRepository } from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';
import {
    InvalidTimetableDepartmentIdsError,
    InvalidTimetableLaneSelectionError,
    InvalidTimetableTimeRangeError,
    type ITimetableRepository,
    type TimetableItem,
} from '@backend/src/infrastructure/repositories/timetable/ITimetableRepository';
import type { RoomWithDepartments } from '@backend/src/infrastructure/repositories/room/IRoomRepository';
import type { Program } from '@backend/src/infrastructure/repositories/program/IProgramRepository';
import type { ShopItem } from '@backend/src/infrastructure/repositories/shop-item/IShopItemRepository';
import type { OtherItem } from '@backend/src/infrastructure/repositories/other-item/IOtherItemRepository';
import type { IRoomRepository } from '@backend/src/infrastructure/repositories/room/IRoomRepository';
import type { IProgramRepository } from '@backend/src/infrastructure/repositories/program/IProgramRepository';
import type { IShopItemRepository } from '@backend/src/infrastructure/repositories/shop-item/IShopItemRepository';
import type { IOtherItemRepository } from '@backend/src/infrastructure/repositories/other-item/IOtherItemRepository';
import { CreateTimetableItemUseCase } from '@backend/src/use-cases/timetable/CreateTimetableItemUseCase';
import { UpdateTimetableItemUseCase } from '@backend/src/use-cases/timetable/UpdateTimetableItemUseCase';
import { DeleteTimetableItemUseCase } from '@backend/src/use-cases/timetable/DeleteTimetableItemUseCase';
import { CreateRoomUseCase } from '@backend/src/use-cases/room/CreateRoomUseCase';
import { UpdateRoomUseCase } from '@backend/src/use-cases/room/UpdateRoomUseCase';
import { DeleteRoomUseCase } from '@backend/src/use-cases/room/DeleteRoomUseCase';
import { CreateProgramUseCase } from '@backend/src/use-cases/program/CreateProgramUseCase';
import { UpdateProgramUseCase } from '@backend/src/use-cases/program/UpdateProgramUseCase';
import { DeleteProgramUseCase } from '@backend/src/use-cases/program/DeleteProgramUseCase';
import { CreateShopItemUseCase } from '@backend/src/use-cases/shop-item/CreateShopItemUseCase';
import { UpdateShopItemUseCase } from '@backend/src/use-cases/shop-item/UpdateShopItemUseCase';
import { DeleteShopItemUseCase } from '@backend/src/use-cases/shop-item/DeleteShopItemUseCase';
import { CreateOtherItemUseCase } from '@backend/src/use-cases/other-item/CreateOtherItemUseCase';
import { UpdateOtherItemUseCase } from '@backend/src/use-cases/other-item/UpdateOtherItemUseCase';
import { DeleteOtherItemUseCase } from '@backend/src/use-cases/other-item/DeleteOtherItemUseCase';
import { CreateDepartmentUseCase } from '@backend/src/use-cases/department/CreateDepartmentUseCase';
import { UpdateDepartmentUseCase } from '@backend/src/use-cases/department/UpdateDepartmentUseCase';
import { DeleteDepartmentUseCase } from '@backend/src/use-cases/department/DeleteDepartmentUseCase';
import { GetDepartmentsUseCase } from '@backend/src/use-cases/department/GetDepartmentsUseCase';

const EVENT_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_EVENT_ID = '00000000-0000-4000-8000-000000000002';

const baseDepartment: Department = {
    id: '60000000-0000-4000-8000-000000000001',
    eventId: EVENT_ID,
    name: '企画部',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

const baseTimetable: TimetableItem = {
    id: '10000000-0000-4000-8000-000000000001',
    eventId: EVENT_ID,
    title: '開会式',
    startTime: new Date('2025-08-01T10:00:00.000Z'),
    endTime: new Date('2025-08-01T11:00:00.000Z'),
    location: '会場A',
    description: null,
    isPublic: true,
    departments: [],
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

const baseRoom: RoomWithDepartments = {
    id: '20000000-0000-4000-8000-000000000001',
    eventId: EVENT_ID,
    buildingName: 'A棟',
    floor: '1F',
    roomName: '本部',
    preDayManagerId: null,
    preDayManagerName: null,
    preDayPurpose: null,
    dayManagerId: '60000000-0000-4000-8000-000000000001',
    dayManagerName: '運営部',
    dayPurpose: '受付',
    notes: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

const baseProgram: Program = {
    id: '30000000-0000-4000-8000-000000000001',
    eventId: EVENT_ID,
    name: '企画A',
    location: 'ホール',
    startTime: new Date('2025-08-01T12:00:00.000Z'),
    endTime: new Date('2025-08-01T13:00:00.000Z'),
    description: null,
    imageUrl: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

const baseShopItem: ShopItem = {
    id: '40000000-0000-4000-8000-000000000001',
    eventId: EVENT_ID,
    name: 'グッズA',
    price: 500,
    description: null,
    imageUrl: 'https://assets.example.com/a.webp',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

const SHOP_ITEM_ASSET_BASE_URL = 'https://assets.example.com';

const baseOtherItem: OtherItem = {
    id: '50000000-0000-4000-8000-000000000001',
    eventId: EVENT_ID,
    title: '注意事項',
    content: '集合時間は9時です',
    imageUrl: null,
    displayOrder: 1,
    createdBy: 'admin',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

function mockTimetableRepository(overrides: Partial<ITimetableRepository> = {}) {
    return {
        findByEventId: jest.fn(),
        findById: jest
            .fn<ITimetableRepository['findById']>()
            .mockImplementation(() => Promise.resolve(baseTimetable)),
        search: jest.fn(),
        create: jest
            .fn<ITimetableRepository['create']>()
            .mockImplementation(() => Promise.resolve(baseTimetable)),
        update: jest
            .fn<ITimetableRepository['update']>()
            .mockImplementation(() => Promise.resolve(baseTimetable)),
        delete: jest
            .fn<ITimetableRepository['delete']>()
            .mockImplementation(() => Promise.resolve(true)),
        ...overrides,
    } as unknown as jest.Mocked<ITimetableRepository>;
}

function mockRoomRepository(overrides: Partial<IRoomRepository> = {}) {
    return {
        findByEventId: jest.fn(),
        search: jest.fn(),
        create: jest
            .fn<IRoomRepository['create']>()
            .mockImplementation(() => Promise.resolve(baseRoom)),
        update: jest
            .fn<IRoomRepository['update']>()
            .mockImplementation(() => Promise.resolve(baseRoom)),
        delete: jest
            .fn<IRoomRepository['delete']>()
            .mockImplementation(() => Promise.resolve(true)),
        ...overrides,
    } as unknown as jest.Mocked<IRoomRepository>;
}

function mockProgramRepository(overrides: Partial<IProgramRepository> = {}) {
    return {
        findByEventId: jest.fn(),
        findById: jest
            .fn<IProgramRepository['findById']>()
            .mockImplementation(() => Promise.resolve(baseProgram)),
        search: jest.fn(),
        create: jest
            .fn<IProgramRepository['create']>()
            .mockImplementation(() => Promise.resolve(baseProgram)),
        update: jest
            .fn<IProgramRepository['update']>()
            .mockImplementation(() => Promise.resolve(baseProgram)),
        delete: jest
            .fn<IProgramRepository['delete']>()
            .mockImplementation(() => Promise.resolve(true)),
        ...overrides,
    } as unknown as jest.Mocked<IProgramRepository>;
}

function mockShopItemRepository(overrides: Partial<IShopItemRepository> = {}) {
    return {
        findByEventId: jest.fn(),
        search: jest.fn(),
        create: jest
            .fn<IShopItemRepository['create']>()
            .mockImplementation(() => Promise.resolve(baseShopItem)),
        update: jest
            .fn<IShopItemRepository['update']>()
            .mockImplementation(() => Promise.resolve(baseShopItem)),
        delete: jest
            .fn<IShopItemRepository['delete']>()
            .mockImplementation(() => Promise.resolve(true)),
        ...overrides,
    } as unknown as jest.Mocked<IShopItemRepository>;
}

function mockDepartmentRepository(overrides: Partial<IDepartmentRepository> = {}) {
    return {
        findByEventId: jest.fn(),
        create: jest
            .fn<IDepartmentRepository['create']>()
            .mockImplementation(() => Promise.resolve(baseDepartment)),
        createBulk: jest
            .fn<IDepartmentRepository['createBulk']>()
            .mockImplementation(() => Promise.resolve([baseDepartment])),
        update: jest
            .fn<IDepartmentRepository['update']>()
            .mockImplementation(() => Promise.resolve(baseDepartment)),
        delete: jest
            .fn<IDepartmentRepository['delete']>()
            .mockImplementation(() => Promise.resolve(true)),
        ...overrides,
    } as unknown as jest.Mocked<IDepartmentRepository>;
}

function mockOtherItemRepository(overrides: Partial<IOtherItemRepository> = {}) {
    return {
        findByEventId: jest.fn(),
        search: jest.fn(),
        create: jest
            .fn<IOtherItemRepository['create']>()
            .mockImplementation(() => Promise.resolve(baseOtherItem)),
        update: jest
            .fn<IOtherItemRepository['update']>()
            .mockImplementation(() => Promise.resolve(baseOtherItem)),
        delete: jest
            .fn<IOtherItemRepository['delete']>()
            .mockImplementation(() => Promise.resolve(true)),
        ...overrides,
    } as unknown as jest.Mocked<IOtherItemRepository>;
}

function expectFailure<T extends { success: boolean }>(
    result: T,
): asserts result is Extract<T, { success: false }> {
    expect(result.success).toBe(false);
}

// Timetable

describe('Timetable use cases', () => {
    it('CreateTimetableItemUseCase sets endTime to startTime', async () => {
        const repo = mockTimetableRepository();
        const useCase = new CreateTimetableItemUseCase(repo);
        await useCase.execute({
            eventId: EVENT_ID,
            title: 'テスト',
            startTime: '2025-08-01T10:00:00.000Z',
            location: 'A',
            description: undefined,
        });
        expect(repo.create).toHaveBeenCalledWith({
            eventId: EVENT_ID,
            title: 'テスト',
            startTime: new Date('2025-08-01T10:00:00.000Z'),
            endTime: new Date('2025-08-01T10:00:00.000Z'),
            location: 'A',
            description: null,
            isPublic: true,
            departmentIds: [],
        });
    });

    it('CreateTimetableItemUseCase sets empty location when omitted', async () => {
        const repo = mockTimetableRepository();
        const useCase = new CreateTimetableItemUseCase(repo);
        await useCase.execute({
            eventId: EVENT_ID,
            title: '場所未定の案内',
            startTime: '2025-08-01T10:00:00.000Z',
            description: null,
        });
        expect(repo.create).toHaveBeenCalledWith(
            expect.objectContaining({ location: '' }),
        );
    });

    it('CreateTimetableItemUseCase rejects item without target lane', async () => {
        const repo = mockTimetableRepository();
        const useCase = new CreateTimetableItemUseCase(repo);
        const result = await useCase.execute({
            eventId: EVENT_ID,
            title: '対象なし',
            startTime: '2025-08-01T10:00:00.000Z',
            isPublic: false,
            departmentIds: [],
        });
        expectFailure(result);
        expect(result.status).toBe(400);
        expect(repo.create).not.toHaveBeenCalled();
    });

    it('CreateTimetableItemUseCase rejects an end time before the start time', async () => {
        const repo = mockTimetableRepository();
        const useCase = new CreateTimetableItemUseCase(repo);
        const result = await useCase.execute({
            eventId: EVENT_ID,
            title: '時刻逆転',
            startTime: '2025-08-01T11:00:00.000Z',
            endTime: '2025-08-01T10:00:00.000Z',
        });
        expectFailure(result);
        expect(result.status).toBe(400);
        expect(result.error).toBe('終了時刻は開始時刻以降にしてください');
        expect(repo.create).not.toHaveBeenCalled();
    });

    it('CreateTimetableItemUseCase returns 400 for invalid department ids', async () => {
        const repo = mockTimetableRepository({
            create: jest
                .fn<ITimetableRepository['create']>()
                .mockImplementation(() =>
                    Promise.reject(new InvalidTimetableDepartmentIdsError()),
                ),
        });
        const useCase = new CreateTimetableItemUseCase(repo);
        const result = await useCase.execute({
            eventId: EVENT_ID,
            title: '不正部署',
            startTime: '2025-08-01T10:00:00.000Z',
            isPublic: false,
            departmentIds: [baseDepartment.id],
        });
        expectFailure(result);
        expect(result.status).toBe(400);
    });

    it('UpdateTimetableItemUseCase updates valid startTime only when endTime is omitted', async () => {
        const repo = mockTimetableRepository();
        const useCase = new UpdateTimetableItemUseCase(repo);
        await useCase.execute({
            id: baseTimetable.id,
            eventId: EVENT_ID,
            payload: {
                startTime: '2025-08-01T10:30:00.000Z',
            },
        });
        expect(repo.update).toHaveBeenCalledWith(baseTimetable.id, EVENT_ID, {
            startTime: new Date('2025-08-01T10:30:00.000Z'),
        });
    });

    it('UpdateTimetableItemUseCase rejects start-only update after existing endTime', async () => {
        const repo = mockTimetableRepository();
        const useCase = new UpdateTimetableItemUseCase(repo);
        const result = await useCase.execute({
            id: baseTimetable.id,
            eventId: EVENT_ID,
            payload: {
                startTime: '2025-08-01T12:00:00.000Z',
            },
        });
        expectFailure(result);
        expect(result.status).toBe(400);
        expect(repo.update).not.toHaveBeenCalled();
    });

    it('UpdateTimetableItemUseCase rejects item without target lane', async () => {
        const repo = mockTimetableRepository();
        const useCase = new UpdateTimetableItemUseCase(repo);
        const result = await useCase.execute({
            id: baseTimetable.id,
            eventId: EVENT_ID,
            payload: { isPublic: false },
        });
        expectFailure(result);
        expect(result.status).toBe(400);
        expect(repo.update).not.toHaveBeenCalled();
    });

    it('UpdateTimetableItemUseCase returns 400 for invalid department ids', async () => {
        const repo = mockTimetableRepository({
            update: jest
                .fn<ITimetableRepository['update']>()
                .mockImplementation(() =>
                    Promise.reject(new InvalidTimetableDepartmentIdsError()),
                ),
        });
        const useCase = new UpdateTimetableItemUseCase(repo);
        const result = await useCase.execute({
            id: baseTimetable.id,
            eventId: EVENT_ID,
            payload: { departmentIds: [baseDepartment.id] },
        });
        expectFailure(result);
        expect(result.status).toBe(400);
    });

    it('UpdateTimetableItemUseCase returns 400 when repository rejects an empty lane selection', async () => {
        const repo = mockTimetableRepository({
            update: jest
                .fn<ITimetableRepository['update']>()
                .mockImplementation(() =>
                    Promise.reject(new InvalidTimetableLaneSelectionError()),
                ),
        });
        const useCase = new UpdateTimetableItemUseCase(repo);
        const result = await useCase.execute({
            id: baseTimetable.id,
            eventId: EVENT_ID,
            payload: { departmentIds: [baseDepartment.id] },
        });
        expectFailure(result);
        expect(result.status).toBe(400);
        expect(result.error).toBe(
            '全体向けまたは部署タグを1つ以上指定してください',
        );
    });

    it('UpdateTimetableItemUseCase returns 400 when repository rejects the time range', async () => {
        const repo = mockTimetableRepository({
            update: jest
                .fn<ITimetableRepository['update']>()
                .mockImplementation(() =>
                    Promise.reject(new InvalidTimetableTimeRangeError()),
                ),
        });
        const useCase = new UpdateTimetableItemUseCase(repo);
        const result = await useCase.execute({
            id: baseTimetable.id,
            eventId: EVENT_ID,
            payload: { title: '更新後タイトル' },
        });
        expectFailure(result);
        expect(result.status).toBe(400);
        expect(result.error).toBe('終了時刻は開始時刻以降にしてください');
    });

    it('UpdateTimetableItemUseCase rejects empty payload', async () => {
        const repo = mockTimetableRepository();
        const useCase = new UpdateTimetableItemUseCase(repo);
        const result = await useCase.execute({
            id: baseTimetable.id,
            eventId: EVENT_ID,
            payload: {},
        });
        expectFailure(result);
        expect(result.status).toBe(400);
        expect(repo.update).not.toHaveBeenCalled();
    });

    it('DeleteTimetableItemUseCase returns 404 when not found', async () => {
        const repo = mockTimetableRepository({
            delete: jest
                .fn<ITimetableRepository['delete']>()
                .mockImplementation(() => Promise.resolve(false)),
        });
        const useCase = new DeleteTimetableItemUseCase(repo);
        const result = await useCase.execute({ id: baseTimetable.id, eventId: EVENT_ID });
        expectFailure(result);
        expect(result.status).toBe(404);
    });
});

// Rooms

describe('Room use cases', () => {
    it('CreateRoomUseCase normalizes nullable fields', async () => {
        const repo = mockRoomRepository();
        const useCase = new CreateRoomUseCase(repo);
        await useCase.execute({
            eventId: EVENT_ID,
            buildingName: 'A棟',
            floor: '1F',
            roomName: '本部',
            dayManagerId: baseRoom.dayManagerId,
            dayPurpose: '受付',
        });
        expect(repo.create).toHaveBeenCalledWith({
            eventId: EVENT_ID,
            buildingName: 'A棟',
            floor: '1F',
            roomName: '本部',
            preDayManagerId: null,
            preDayPurpose: null,
            dayManagerId: baseRoom.dayManagerId,
            dayPurpose: '受付',
            notes: null,
        });
    });

    it('UpdateRoomUseCase rejects when no fields specified', async () => {
        const repo = mockRoomRepository();
        const useCase = new UpdateRoomUseCase(repo);
        const result = await useCase.execute({ id: baseRoom.id, eventId: EVENT_ID, payload: {} });
        expectFailure(result);
        expect(result.status).toBe(400);
        expect(repo.update).not.toHaveBeenCalled();
    });

    it('DeleteRoomUseCase returns 404 when room missing', async () => {
        const repo = mockRoomRepository({
            delete: jest
                .fn<IRoomRepository['delete']>()
                .mockImplementation(() => Promise.resolve(false)),
        });
        const useCase = new DeleteRoomUseCase(repo);
        const result = await useCase.execute({ id: baseRoom.id, eventId: EVENT_ID });
        expectFailure(result);
        expect(result.status).toBe(404);
    });
});

// Programs

describe('Program use cases', () => {
    it('CreateProgramUseCase validates start/end order', async () => {
        const repo = mockProgramRepository();
        const useCase = new CreateProgramUseCase(
            repo,
            SHOP_ITEM_ASSET_BASE_URL,
        );
        const result = await useCase.execute({
            eventId: EVENT_ID,
            name: '企画',
            location: 'ホール',
            startTime: '2025-08-01T12:00:00.000Z',
            endTime: '2025-08-01T11:00:00.000Z',
        });
        expectFailure(result);
        expect(result.status).toBe(400);
    });

    it('UpdateProgramUseCase converts ISO strings to Date', async () => {
        const repo = mockProgramRepository();
        const useCase = new UpdateProgramUseCase(
            repo,
            SHOP_ITEM_ASSET_BASE_URL,
        );
        await useCase.execute({
            id: baseProgram.id,
            eventId: EVENT_ID,
            payload: {
                startTime: '2025-08-01T12:00:00.000Z',
                endTime: '2025-08-01T13:00:00.000Z',
            },
        });
        expect(repo.update).toHaveBeenCalledWith(baseProgram.id, EVENT_ID, {
            startTime: new Date('2025-08-01T12:00:00.000Z'),
            endTime: new Date('2025-08-01T13:00:00.000Z'),
        });
    });

    it('CreateProgramUseCase builds imageUrl from base URL', async () => {
        const repo = mockProgramRepository();
        const useCase = new CreateProgramUseCase(
            repo,
            `${SHOP_ITEM_ASSET_BASE_URL}/`,
        );
        const imageKey = `programs/${EVENT_ID}/program.webp`;
        await useCase.execute({
            eventId: EVENT_ID,
            name: '企画',
            location: 'ホール',
            startTime: '2025-08-01T12:00:00.000Z',
            endTime: '2025-08-01T13:00:00.000Z',
            imageKey,
        });
        expect(repo.create).toHaveBeenCalledWith(
            expect.objectContaining({
                imageKey,
                imageUrl: `${SHOP_ITEM_ASSET_BASE_URL}/${imageKey}`,
            }),
        );
    });

    it('UpdateProgramUseCase rejects invalid image key', async () => {
        const repo = mockProgramRepository();
        const useCase = new UpdateProgramUseCase(
            repo,
            SHOP_ITEM_ASSET_BASE_URL,
        );
        const result = await useCase.execute({
            id: baseProgram.id,
            eventId: EVENT_ID,
            payload: { imageKey: 'invalid/path' },
        });
        expectFailure(result);
        expect(result.status).toBe(400);
        expect(repo.update).not.toHaveBeenCalled();
    });

    it('DeleteProgramUseCase returns 404 when repository reports missing', async () => {
        const repo = mockProgramRepository({
            delete: jest
                .fn<IProgramRepository['delete']>()
                .mockImplementation(() => Promise.resolve(false)),
        });
        const useCase = new DeleteProgramUseCase(repo);
        const result = await useCase.execute({ id: baseProgram.id, eventId: EVENT_ID });
        expectFailure(result);
        expect(result.status).toBe(404);
    });
});

// Shop items

describe('Shop item use cases', () => {
    it('CreateShopItemUseCase rejects invalid image key', async () => {
        const repo = mockShopItemRepository();
        const useCase = new CreateShopItemUseCase(
            repo,
            SHOP_ITEM_ASSET_BASE_URL,
        );
        const result = await useCase.execute({
            eventId: EVENT_ID,
            name: 'グッズ',
            price: 500,
            imageKey: 'invalid/path',
        });
        expectFailure(result);
        expect(result.status).toBe(400);
        expect(repo.create).not.toHaveBeenCalled();
    });

    it('CreateShopItemUseCase builds imageUrl from base URL', async () => {
        const repo = mockShopItemRepository();
        const useCase = new CreateShopItemUseCase(
            repo,
            `${SHOP_ITEM_ASSET_BASE_URL}/`,
        );
        const imageKey = `shop-items/${EVENT_ID}/file.webp`;
        await useCase.execute({
            eventId: EVENT_ID,
            name: 'グッズ',
            price: 500,
            imageKey,
        });
        expect(repo.create).toHaveBeenCalledWith(
            expect.objectContaining({
                imageKey,
                imageUrl: `${SHOP_ITEM_ASSET_BASE_URL}/${imageKey}`,
            }),
        );
    });

    it('UpdateShopItemUseCase rejects invalid image key', async () => {
        const repo = mockShopItemRepository();
        const useCase = new UpdateShopItemUseCase(
            repo,
            SHOP_ITEM_ASSET_BASE_URL,
        );
        const result = await useCase.execute({
            id: baseShopItem.id,
            eventId: EVENT_ID,
            payload: { imageKey: 'invalid' },
        });
        expectFailure(result);
        expect(result.status).toBe(400);
        expect(repo.update).not.toHaveBeenCalled();
    });

    it('UpdateShopItemUseCase rebuilds imageUrl when imageKey changes', async () => {
        const repo = mockShopItemRepository();
        const useCase = new UpdateShopItemUseCase(repo, SHOP_ITEM_ASSET_BASE_URL);
        const imageKey = `shop-items/${EVENT_ID}/next.webp`;
        await useCase.execute({
            id: baseShopItem.id,
            eventId: EVENT_ID,
            payload: { imageKey },
        });
        expect(repo.update).toHaveBeenCalledWith(
            baseShopItem.id,
            EVENT_ID,
            expect.objectContaining({
                imageKey,
                imageUrl: `${SHOP_ITEM_ASSET_BASE_URL}/${imageKey}`,
            }),
        );
    });

    it('DeleteShopItemUseCase returns 404 when nothing deleted', async () => {
        const repo = mockShopItemRepository({
            delete: jest
                .fn<IShopItemRepository['delete']>()
                .mockImplementation(() => Promise.resolve(false)),
        });
        const useCase = new DeleteShopItemUseCase(repo);
        const result = await useCase.execute({ id: baseShopItem.id, eventId: EVENT_ID });
        expectFailure(result);
        expect(result.status).toBe(404);
    });
});

// Other items

describe('Other item use cases', () => {
    it('CreateOtherItemUseCase forwards createdBy', async () => {
        const repo = mockOtherItemRepository();
        const useCase = new CreateOtherItemUseCase(
            repo,
            SHOP_ITEM_ASSET_BASE_URL,
        );
        await useCase.execute({
            eventId: EVENT_ID,
            title: '連絡',
            content: 'テスト',
            displayOrder: 1,
            createdBy: 'admin',
        });
        expect(repo.create).toHaveBeenCalledWith({
            eventId: EVENT_ID,
            title: '連絡',
            content: 'テスト',
            imageKey: null,
            imageUrl: null,
            displayOrder: 1,
            createdBy: 'admin',
        });
    });

    it('CreateOtherItemUseCase builds imageUrl from base URL', async () => {
        const repo = mockOtherItemRepository();
        const useCase = new CreateOtherItemUseCase(
            repo,
            `${SHOP_ITEM_ASSET_BASE_URL}/`,
        );
        const imageKey = `others/${EVENT_ID}/note.webp`;
        await useCase.execute({
            eventId: EVENT_ID,
            title: '連絡',
            content: 'テスト',
            imageKey,
            displayOrder: 1,
            createdBy: 'admin',
        });
        expect(repo.create).toHaveBeenCalledWith(
            expect.objectContaining({
                imageKey,
                imageUrl: `${SHOP_ITEM_ASSET_BASE_URL}/${imageKey}`,
            }),
        );
    });

    it('UpdateOtherItemUseCase rejects invalid image key', async () => {
        const repo = mockOtherItemRepository();
        const useCase = new UpdateOtherItemUseCase(
            repo,
            SHOP_ITEM_ASSET_BASE_URL,
        );
        const result = await useCase.execute({
            id: baseOtherItem.id,
            eventId: EVENT_ID,
            payload: { imageKey: 'invalid' },
        });
        expectFailure(result);
        expect(result.status).toBe(400);
        expect(repo.update).not.toHaveBeenCalled();
    });

    it('UpdateOtherItemUseCase requires at least one field', async () => {
        const repo = mockOtherItemRepository();
        const useCase = new UpdateOtherItemUseCase(
            repo,
            SHOP_ITEM_ASSET_BASE_URL,
        );
        const result = await useCase.execute({ id: baseOtherItem.id, eventId: EVENT_ID, payload: {} });
        expectFailure(result);
        expect(result.status).toBe(400);
        expect(repo.update).not.toHaveBeenCalled();
    });

    it('DeleteOtherItemUseCase returns 404 when missing', async () => {
        const repo = mockOtherItemRepository({
            delete: jest
                .fn<IOtherItemRepository['delete']>()
                .mockImplementation(() => Promise.resolve(false)),
        });
        const useCase = new DeleteOtherItemUseCase(repo);
        const result = await useCase.execute({ id: baseOtherItem.id, eventId: EVENT_ID });
        expectFailure(result);
        expect(result.status).toBe(404);
    });
});

// Departments

describe('Department use cases', () => {
    it('GetDepartmentsUseCase forwards eventId to repository', async () => {
        const repo = mockDepartmentRepository({
            findByEventId: jest
                .fn<IDepartmentRepository['findByEventId']>()
                .mockImplementation(() => Promise.resolve([baseDepartment])),
        });
        const useCase = new GetDepartmentsUseCase(repo);
        const result = await useCase.execute(EVENT_ID);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toHaveLength(1);
        expect(repo.findByEventId).toHaveBeenCalledWith(EVENT_ID);
    });

    it('CreateDepartmentUseCase forwards name and eventId to repository', async () => {
        const repo = mockDepartmentRepository();
        const useCase = new CreateDepartmentUseCase(repo);
        await useCase.execute({ eventId: EVENT_ID, name: '企画部' });
        expect(repo.create).toHaveBeenCalledWith({
            eventId: EVENT_ID,
            name: '企画部',
        });
    });

    it('UpdateDepartmentUseCase returns 404 when department missing', async () => {
        const repo = mockDepartmentRepository({
            update: jest
                .fn<IDepartmentRepository['update']>()
                .mockImplementation(() => Promise.resolve(null)),
        });
        const useCase = new UpdateDepartmentUseCase(repo);
        const result = await useCase.execute({
            id: baseDepartment.id,
            eventId: EVENT_ID,
            payload: { name: '変更' },
        });
        expectFailure(result);
        expect(result.status).toBe(404);
        expect(result.error).toContain('見つかりません');
    });

    it('DeleteDepartmentUseCase returns 404 when not found', async () => {
        const repo = mockDepartmentRepository({
            delete: jest
                .fn<IDepartmentRepository['delete']>()
                .mockImplementation(() => Promise.resolve(false)),
        });
        const useCase = new DeleteDepartmentUseCase(repo);
        const result = await useCase.execute({ id: baseDepartment.id, eventId: EVENT_ID });
        expectFailure(result);
        expect(result.status).toBe(404);
    });

    it('DeleteDepartmentUseCase returns 409 on FK constraint violation', async () => {
        const repo = mockDepartmentRepository({
            delete: jest
                .fn<IDepartmentRepository['delete']>()
                .mockImplementation(() =>
                    Promise.reject(new Error('foreign key constraint violation')),
                ),
        });
        const useCase = new DeleteDepartmentUseCase(repo);
        const result = await useCase.execute({ id: baseDepartment.id, eventId: OTHER_EVENT_ID });
        expectFailure(result);
        expect(result.status).toBe(409);
    });
});
