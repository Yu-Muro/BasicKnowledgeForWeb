import { CockroachDialect } from 'drizzle-orm/cockroach-core';
import type { SQL } from 'drizzle-orm';
import { describe, expect, it, jest } from '@jest/globals';
import type { createDatabaseClient } from '@backend/src/db/connection';
import type { User } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import { UserRepository } from '@backend/src/infrastructure/repositories/user/UserRepository';

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
    sessionVersion: 0,
};

describe('UserRepository', () => {
    describe('findAll', () => {
        it('全ユーザーを created_at DESC 順で返す', async () => {
            const orderByMock = jest
                .fn()
                .mockImplementation(() => Promise.resolve([mockUser]));
            const db = {
                select: jest.fn().mockReturnValue({
                    from: jest.fn().mockReturnValue({
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
        it('ユーザーを作成して返す', async () => {
            const valuesMock = jest.fn().mockReturnValue({
                returning: jest
                    .fn()
                    .mockImplementation(() => Promise.resolve([mockUser])),
            });
            const db = {
                insert: jest.fn().mockReturnValue({ values: valuesMock }),
            } as unknown as DatabaseClient;
            const repository = new UserRepository(db);

            const input = {
                name: 'テストユーザー',
                email: 'test@example.com',
                password: 'hashedPassword',
                role: 'user',
                departmentId: '60000000-0000-4000-8000-000000000001',
            };
            const result = await repository.create(input);

            expect(result).toEqual(mockUser);
            expect(valuesMock).toHaveBeenCalledWith(input);
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
        it('パスワードを更新する', async () => {
            const whereMock = jest
                .fn()
                .mockImplementation(() => Promise.resolve([]));
            const db = {
                update: jest.fn().mockReturnValue({
                    set: jest.fn().mockReturnValue({ where: whereMock }),
                }),
            } as unknown as DatabaseClient;
            const repository = new UserRepository(db);

            await repository.updatePassword(mockUser.id, 'hashedpassword');

            expect(whereMock).toHaveBeenCalledTimes(1);
        });
    });
});

describe('削除・所属更新のクエリ', () => {
    function updateChain(rows: User[]) {
        const returning = jest
            .fn()
            .mockImplementation(() => Promise.resolve(rows));
        const where = jest.fn().mockReturnValue({ returning });
        const set = jest.fn().mockReturnValue({ where });
        const db = {
            update: jest.fn().mockReturnValue({ set }),
        } as unknown as DatabaseClient;
        return { db, set, where };
    }
    it('論理削除時に所属を解除し、削除済みユーザーは更新対象から除外する', async () => {
        const { db, set, where } = updateChain([mockUser]);
        expect(await new UserRepository(db).softDelete(mockUser.id)).toBe(true);
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({
                departmentId: null,
                deletedAt: expect.any(Date),
            }),
        );
        const query = new CockroachDialect().sqlToQuery(
            where.mock.calls[0][0] as SQL,
        );
        expect(query.sql).toContain('"deleted_at" is null');
        expect(query.params).toContain(mockUser.id);
    });
    it('削除済み・存在しない対象ではfalseを返す', async () => {
        expect(
            await new UserRepository(updateChain([]).db).softDelete(
                mockUser.id,
            ),
        ).toBe(false);
    });
    it('所属更新は削除済みユーザーを除外する', async () => {
        const { db, set, where } = updateChain([mockUser]);
        expect(
            await new UserRepository(db).updateDepartment(
                mockUser.id,
                mockUser.departmentId!,
            ),
        ).toEqual(mockUser);
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({ departmentId: mockUser.departmentId }),
        );
        const query = new CockroachDialect().sqlToQuery(
            where.mock.calls[0][0] as SQL,
        );
        expect(query.sql).toContain('"deleted_at" is null');
        expect(query.params).toContain(mockUser.id);
    });
    it('削除済み・存在しない対象の所属更新ではnullを返す', async () => {
        expect(
            await new UserRepository(updateChain([]).db).updateDepartment(
                mockUser.id,
                mockUser.departmentId!,
            ),
        ).toBeNull();
    });
    it('復元は削除済み行だけを更新しセッション世代を進める', async () => {
        const { db, set, where } = updateChain([mockUser]);
        expect(
            await new UserRepository(db).restore(
                mockUser.id,
                mockUser.departmentId,
                0,
            ),
        ).toEqual(mockUser);
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({
                deletedAt: null,
                departmentId: mockUser.departmentId,
            }),
        );
        const condition = new CockroachDialect().sqlToQuery(
            where.mock.calls[0][0] as SQL,
        );
        expect(condition.sql).toContain('"deleted_at" is not null');
        expect(condition.sql).toContain('"session_version" =');
        expect(condition.params).toContain(0);
        expect(condition.params).toContain(mockUser.id);
        const values = set.mock.calls[0][0] as { sessionVersion: SQL };
        expect(
            new CockroachDialect().sqlToQuery(values.sessionVersion).sql,
        ).toContain('"session_version" + 1');
        expect(
            await new UserRepository(updateChain([]).db).restore(
                mockUser.id,
                null,
                0,
            ),
        ).toBeNull();
    });
});
