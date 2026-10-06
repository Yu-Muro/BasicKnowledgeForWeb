import type { createDatabaseClient } from '@backend/src/db/connection';
import type { User } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import { UserRepository } from '@backend/src/infrastructure/repositories/user/UserRepository';
import { describe, expect, it, jest } from '@jest/globals';

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

const mockUser: User = {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'テストユーザー',
    email: 'test@example.com',
    password: 'hashedPassword',
    role: 'user',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    departmentId: '60000000-0000-4000-8000-000000000001',
    deletedAt: null,
};

describe('UserRepository', () => {
    describe('findAll', () => {
        it('全ユーザーを created_at DESC 順で返す', async () => {
            const orderByMock = jest
                .fn()
                .mockImplementation(() => Promise.resolve([mockUser]));
            const db = {
                select: jest.fn().mockReturnValue({
                    from: jest
                        .fn()
                        .mockReturnValue({
                            where: jest
                                .fn()
                                .mockReturnValue({ orderBy: orderByMock }),
                        }),
                }),
            } as unknown as DatabaseClient;
            const repository = new UserRepository(db);

            const result = await repository.findAll();

            expect(result).toEqual([mockUser]);
            expect(orderByMock).toHaveBeenCalledTimes(1);
        });

        it('ユーザーが存在しない場合、空配列を返す', async () => {
            const db = {
                select: jest.fn().mockReturnValue({
                    from: jest.fn().mockReturnValue({
                        where: jest.fn().mockReturnValue({
                            orderBy: jest
                                .fn()
                                .mockImplementation(() => Promise.resolve([])),
                        }),
                    }),
                }),
            } as unknown as DatabaseClient;
            const repository = new UserRepository(db);

            const result = await repository.findAll();

            expect(result).toEqual([]);
        });
    });

    describe('findById', () => {
        it('ID が一致するユーザーを返す', async () => {
            const limitMock = jest
                .fn()
                .mockImplementation(() => Promise.resolve([mockUser]));
            const db = {
                select: jest.fn().mockReturnValue({
                    from: jest.fn().mockReturnValue({
                        where: jest.fn().mockReturnValue({ limit: limitMock }),
                    }),
                }),
            } as unknown as DatabaseClient;
            const repository = new UserRepository(db);

            const result = await repository.findById(mockUser.id);

            expect(result).toEqual(mockUser);
            expect(limitMock).toHaveBeenCalledWith(1);
        });

        it('ユーザーが存在しない場合、null を返す', async () => {
            const db = {
                select: jest.fn().mockReturnValue({
                    from: jest.fn().mockReturnValue({
                        where: jest.fn().mockReturnValue({
                            limit: jest
                                .fn()
                                .mockImplementation(() => Promise.resolve([])),
                        }),
                    }),
                }),
            } as unknown as DatabaseClient;
            const repository = new UserRepository(db);

            const result = await repository.findById('nonexistent-id');

            expect(result).toBeNull();
        });
    });

    describe('findByEmail', () => {
        it('メールアドレスが一致するユーザーを返す', async () => {
            const limitMock = jest
                .fn()
                .mockImplementation(() => Promise.resolve([mockUser]));
            const db = {
                select: jest.fn().mockReturnValue({
                    from: jest.fn().mockReturnValue({
                        where: jest.fn().mockReturnValue({ limit: limitMock }),
                    }),
                }),
            } as unknown as DatabaseClient;
            const repository = new UserRepository(db);

            const result = await repository.findByEmail('test@example.com');

            expect(result).toEqual(mockUser);
            expect(limitMock).toHaveBeenCalledWith(1);
        });

        it('ユーザーが存在しない場合、nullを返す', async () => {
            const db = {
                select: jest.fn().mockReturnValue({
                    from: jest.fn().mockReturnValue({
                        where: jest.fn().mockReturnValue({
                            limit: jest
                                .fn()
                                .mockImplementation(() => Promise.resolve([])),
                        }),
                    }),
                }),
            } as unknown as DatabaseClient;
            const repository = new UserRepository(db);

            const result = await repository.findByEmail('notfound@example.com');

            expect(result).toBeNull();
        });
    });

    describe('create', () => {
        it('ユーザーとcredentialアカウントを同一トランザクションで保存する', async () => {
            const values = jest
                .fn()
                .mockReturnValue({
                    returning: jest
                        .fn()
                        .mockImplementation(() => Promise.resolve([mockUser])),
                });
            const tx = { insert: jest.fn().mockReturnValue({ values }) };
            const db = {
                transaction: jest
                    .fn<
                        (
                            callback: (transaction: typeof tx) => Promise<User>,
                        ) => Promise<User>
                    >()
                    .mockImplementation((callback) => callback(tx)),
            } as unknown as DatabaseClient;
            const input = {
                name: mockUser.name,
                email: mockUser.email,
                password: mockUser.password,
                role: 'user',
                departmentId: mockUser.departmentId!,
            };
            await new UserRepository(db).create(input);
            expect(values).toHaveBeenNthCalledWith(1, input);
            expect(values).toHaveBeenNthCalledWith(2, {
                userId: mockUser.id,
                accountId: mockUser.id,
                providerId: 'credential',
                password: mockUser.password,
            });
        });
    });

    describe('updateRole', () => {
        it('ロールを更新して返す', async () => {
            const updatedUser = { ...mockUser, role: 'admin' };
            const returningMock = jest
                .fn()
                .mockImplementation(() => Promise.resolve([updatedUser]));
            const db = {
                update: jest.fn().mockReturnValue({
                    set: jest.fn().mockReturnValue({
                        where: jest
                            .fn()
                            .mockReturnValue({ returning: returningMock }),
                    }),
                }),
            } as unknown as DatabaseClient;
            const repository = new UserRepository(db);

            const result = await repository.updateRole(mockUser.id, 'admin');

            expect(result).toEqual(updatedUser);
            expect(returningMock).toHaveBeenCalledTimes(1);
        });

        it('対象ユーザーが存在しない場合、null を返す', async () => {
            const db = {
                update: jest.fn().mockReturnValue({
                    set: jest.fn().mockReturnValue({
                        where: jest.fn().mockReturnValue({
                            returning: jest
                                .fn()
                                .mockImplementation(() => Promise.resolve([])),
                        }),
                    }),
                }),
            } as unknown as DatabaseClient;
            const repository = new UserRepository(db);

            const result = await repository.updateRole('nonexistent', 'admin');

            expect(result).toBeNull();
        });
    });

    describe('updatePassword', () => {
        it('両方のハッシュ更新と全セッション失効を同一トランザクションで行う', async () => {
            const where = jest
                .fn()
                .mockReturnValue({
                    returning: jest
                        .fn()
                        .mockImplementation(() =>
                            Promise.resolve([{ id: mockUser.id }]),
                        ),
                });
            const deletion = jest
                .fn()
                .mockImplementation(() => Promise.resolve([]));
            const set = jest.fn().mockReturnValue({ where });
            const tx = {
                update: jest.fn().mockReturnValue({ set }),
                delete: jest.fn().mockReturnValue({ where: deletion }),
            };
            const db = {
                transaction: jest
                    .fn<
                        (
                            callback: (transaction: typeof tx) => Promise<void>,
                        ) => Promise<void>
                    >()
                    .mockImplementation((callback) => callback(tx)),
            } as unknown as DatabaseClient;
            await new UserRepository(db).updatePassword(
                mockUser.id,
                'hashedpassword',
            );
            expect(set).toHaveBeenCalledTimes(2);
            expect(set).toHaveBeenCalledWith(
                expect.objectContaining({ password: 'hashedpassword' }),
            );
            expect(deletion).toHaveBeenCalledTimes(1);
        });
    });
});
