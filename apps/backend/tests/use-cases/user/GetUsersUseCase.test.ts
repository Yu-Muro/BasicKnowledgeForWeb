import { describe, expect, it } from '@jest/globals';
import type { IUserRepository, User } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import { GetUsersUseCase } from '@backend/src/use-cases/user/GetUsersUseCase';

const mockUser: User = {
    id: 'uuid-1',
    name: 'テストユーザー',
    email: 'test@example.com',
    password: 'hashed',
    role: 'user',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    departmentId: '60000000-0000-4000-8000-000000000001',
    deletedAt: null,
};

function createMockRepo(overrides: Partial<IUserRepository> = {}): IUserRepository {
    return {
        findAll: async () => [],
        findById: async () => null,
        findByEmail: async () => null,
        create: async () => mockUser,
        updateRole: async () => null,
        updatePassword: async () => undefined,
        updateDepartment: async () => null,
        softDelete: async () => false,
        ...overrides,
    };
}

describe('GetUsersUseCase', () => {
    it('ユーザー一覧を正常に取得できる（password を除外する）', async () => {
        const repo = createMockRepo({ findAll: async () => [mockUser] });
        const useCase = new GetUsersUseCase(repo);

        const result = await useCase.execute();

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).not.toHaveProperty('password');
        expect(result.data[0].email).toBe(mockUser.email);
    });

    it('ユーザーが存在しない場合は空配列を返す', async () => {
        const repo = createMockRepo({ findAll: async () => [] });
        const useCase = new GetUsersUseCase(repo);

        const result = await useCase.execute();

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data).toEqual([]);
    });

    it('DBエラー時にsuccess: falseとエラーメッセージを返す', async () => {
        const repo = createMockRepo({
            findAll: async () => {
                throw new Error('DB接続エラー');
            },
        });
        const useCase = new GetUsersUseCase(repo);

        const result = await useCase.execute();

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error).toBe('DB接続エラー');
    });

    it('Errorでない例外時にデフォルトメッセージを返す', async () => {
        const repo = createMockRepo({
            findAll: async () => {
                throw 'unexpected';
            },
        });
        const useCase = new GetUsersUseCase(repo);

        const result = await useCase.execute();

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error).toBe('ユーザーの取得に失敗しました');
    });
});
