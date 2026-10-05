import { departmentRepository } from '../../helpers/departmentRepository';
import { describe, expect, it } from '@jest/globals';
import type {
    IUserRepository,
    User,
} from '@backend/src/infrastructure/repositories/user/IUserRepository';
import { UpdateUserRoleUseCase } from '@backend/src/use-cases/user/UpdateUserRoleUseCase';

const mockUser: User = {
    id: '00000000-0000-4000-8000-000000000001',
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
        findById: async () => mockUser,
        findByEmail: async () => null,
        create: async () => mockUser,
        updateRole: async () => ({ ...mockUser, role: 'admin' }),
        updatePassword: async () => undefined,
        updateDepartment: async () => null,
        softDelete: async () => false,
        ...overrides,
    };
}

describe('UpdateUserRoleUseCase', () => {
    it('ユーザーが存在する場合、ロールを更新して success: true を返す', async () => {
        const repo = createMockRepo();
        const useCase = new UpdateUserRoleUseCase(repo, departmentRepository);

        const result = await useCase.execute({ id: mockUser.id, role: 'admin' });

        expect(result.success).toBe(true);
    });

    it('ユーザーが存在しない場合、404 エラーを返す', async () => {
        const repo = createMockRepo({ findById: async () => null });
        const useCase = new UpdateUserRoleUseCase(repo, departmentRepository);

        const result = await useCase.execute({ id: 'nonexistent', role: 'admin' });

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.status).toBe(404);
        expect(result.error).toBe('ユーザーが見つかりません');
    });

    it('updateRole が null を返した場合（並行削除など）、404 エラーを返す', async () => {
        const repo = createMockRepo({ updateRole: async () => null });
        const useCase = new UpdateUserRoleUseCase(repo, departmentRepository);

        const result = await useCase.execute({ id: mockUser.id, role: 'admin' });

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.status).toBe(404);
    });

    it('updateRole がエラーをスローした場合、500 エラーを返す', async () => {
        const repo = createMockRepo({
            updateRole: async () => {
                throw new Error('DB error');
            },
        });
        const useCase = new UpdateUserRoleUseCase(repo, departmentRepository);

        const result = await useCase.execute({ id: mockUser.id, role: 'admin' });

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.status).toBe(500);
    });
});
