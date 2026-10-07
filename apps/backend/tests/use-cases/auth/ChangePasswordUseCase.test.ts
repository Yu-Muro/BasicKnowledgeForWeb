import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import type {
    IUserRepository,
    User,
} from '@backend/src/infrastructure/repositories/user/IUserRepository';
import { ChangePasswordUseCase } from '@backend/src/use-cases/auth/ChangePasswordUseCase';
import { hash } from 'bcryptjs';

let testUser: User;

beforeAll(async () => {
    const hashedPassword = await hash('currentpass', 1);
    testUser = {
        id: 'user-1',
        name: 'テストユーザー',
        email: 'test@example.com',
        password: hashedPassword,
        role: 'user',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        departmentId: '60000000-0000-4000-8000-000000000001',
        deletedAt: null,
    sessionVersion: 0,
    };
});

function mockRepository(
    overrides: Partial<IUserRepository> = {},
): IUserRepository {
    return {
        findAll: jest.fn<IUserRepository['findAll']>(),
        findById: jest
            .fn<IUserRepository['findById']>()
            .mockImplementation(() => Promise.resolve(testUser)),
        findByEmail: jest
            .fn<IUserRepository['findByEmail']>()
            .mockResolvedValue(null),
        create: jest.fn<IUserRepository['create']>(),
        updateRole: jest.fn<IUserRepository['updateRole']>(),
        updatePassword: jest
            .fn<IUserRepository['updatePassword']>()
            .mockResolvedValue(undefined),
        updateDepartment: async () => null,
        restore: async () => null,
        softDelete: async () => false,
        ...overrides,
    };
}

describe('ChangePasswordUseCase', () => {
    it('正しい現在のパスワードでパスワードを変更できること', async () => {
        const repo = mockRepository();
        const useCase = new ChangePasswordUseCase(repo);

        const result = await useCase.execute({
            userId: 'user-1',
            currentPassword: 'currentpass',
            newPassword: 'newpassword123',
        });

        expect(result.success).toBe(true);
        expect(repo.updatePassword).toHaveBeenCalledWith(
            'user-1',
            expect.any(String),
        );
    });

    it('現在のパスワードが誤っている場合はエラーを返すこと', async () => {
        const repo = mockRepository();
        const useCase = new ChangePasswordUseCase(repo);

        const result = await useCase.execute({
            userId: 'user-1',
            currentPassword: 'wrongpassword',
            newPassword: 'newpassword123',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toBe('現在のパスワードが正しくありません');
            expect(result.status).toBe(400);
        }
        expect(repo.updatePassword).not.toHaveBeenCalled();
    });

    it('ユーザーが存在しない場合は 404 エラーを返すこと', async () => {
        const repo = mockRepository({
            findById: jest
                .fn<IUserRepository['findById']>()
                .mockResolvedValue(null),
        });
        const useCase = new ChangePasswordUseCase(repo);

        const result = await useCase.execute({
            userId: 'nonexistent',
            currentPassword: 'currentpass',
            newPassword: 'newpassword123',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.status).toBe(404);
        }
    });
});
