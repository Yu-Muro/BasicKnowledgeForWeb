import bcrypt from 'bcryptjs';
import { beforeAll, describe, expect, it } from '@jest/globals';
import type { IUserRepository, User } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import { AuthenticateUserUseCase } from '@backend/src/use-cases/user/AuthenticateUserUseCase';

const CORRECT_PASSWORD = 'correct-password';

let mockUser: User;

beforeAll(async () => {
    const hashedPassword = await bcrypt.hash(CORRECT_PASSWORD, 12);
    mockUser = {
        id: 'uuid-1',
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

function createMockRepo(overrides: Partial<IUserRepository> = {}): IUserRepository {
    return {
        findAll: async () => [],
        findById: async () => null,
        findByEmail: async () => null,
        create: async () => mockUser,
        updateRole: async () => null,
        updatePassword: async () => undefined,
        updateDepartment: async () => null,
        restore: async () => null,
        softDelete: async () => false,
        ...overrides,
    };
}

describe('AuthenticateUserUseCase', () => {
    it('正しい認証情報で認証できる', async () => {
        const repo = createMockRepo({ findByEmail: async () => mockUser });
        const useCase = new AuthenticateUserUseCase(repo);

        const result = await useCase.execute({
            email: 'test@example.com',
            password: CORRECT_PASSWORD,
        });

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.email).toBe('test@example.com');
    });

    it('レスポンスにpasswordフィールドを含まない', async () => {
        const repo = createMockRepo({ findByEmail: async () => mockUser });
        const useCase = new AuthenticateUserUseCase(repo);

        const result = await useCase.execute({
            email: 'test@example.com',
            password: CORRECT_PASSWORD,
        });

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect('password' in result.data).toBe(false);
    });

    it('存在しないメールアドレスの場合はエラーを返す', async () => {
        const repo = createMockRepo({ findByEmail: async () => null });
        const useCase = new AuthenticateUserUseCase(repo);

        const result = await useCase.execute({
            email: 'notfound@example.com',
            password: CORRECT_PASSWORD,
        });

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error).toBe('メールアドレスまたはパスワードが正しくありません');
    });

    it('パスワードが間違っている場合はエラーを返す', async () => {
        const repo = createMockRepo({ findByEmail: async () => mockUser });
        const useCase = new AuthenticateUserUseCase(repo);

        const result = await useCase.execute({
            email: 'test@example.com',
            password: 'wrong-password',
        });

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error).toBe('メールアドレスまたはパスワードが正しくありません');
    });

    it('DBエラー時にsuccess: falseとエラーメッセージを返す', async () => {
        const repo = createMockRepo({
            findByEmail: async () => {
                throw new Error('DB接続エラー');
            },
        });
        const useCase = new AuthenticateUserUseCase(repo);

        const result = await useCase.execute({
            email: 'test@example.com',
            password: CORRECT_PASSWORD,
        });

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error).toBe('DB接続エラー');
    });
});
