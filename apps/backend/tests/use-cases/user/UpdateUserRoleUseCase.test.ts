import { departmentRepository } from '../../helpers/departmentRepository';
import { describe, expect, it, jest } from '@jest/globals';
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
    sessionVersion: 0,
};

function createMockRepo(
    overrides: Partial<IUserRepository> = {},
): IUserRepository {
    return {
        findAll: async () => [],
        findById: async () => mockUser,
        findByEmail: async () => null,
        create: async () => mockUser,
        updateRole: async () => ({ ...mockUser, role: 'admin' }),
        updatePassword: async () => undefined,
        updateDepartment: async () => null,
        restore: async () => null,
        softDelete: async () => false,
        ...overrides,
    };
}

describe('UpdateUserRoleUseCase', () => {
    it('ユーザーが存在する場合、ロールを更新して success: true を返す', async () => {
        const repo = createMockRepo();
        const useCase = new UpdateUserRoleUseCase(repo, departmentRepository);

        const result = await useCase.execute({
            id: mockUser.id,
            role: 'admin',
        });

        expect(result.success).toBe(true);
    });

    it('ユーザーが存在しない場合、404 エラーを返す', async () => {
        const repo = createMockRepo({ findById: async () => null });
        const useCase = new UpdateUserRoleUseCase(repo, departmentRepository);

        const result = await useCase.execute({
            id: 'nonexistent',
            role: 'admin',
        });

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.status).toBe(404);
        expect(result.error).toBe('ユーザーが見つかりません');
    });

    it('updateRole が null を返した場合（並行削除など）、404 エラーを返す', async () => {
        const repo = createMockRepo({ updateRole: async () => null });
        const useCase = new UpdateUserRoleUseCase(repo, departmentRepository);

        const result = await useCase.execute({
            id: mockUser.id,
            role: 'admin',
        });

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

        const result = await useCase.execute({
            id: mockUser.id,
            role: 'admin',
        });

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.status).toBe(500);
    });
});

describe('ロール更新の回帰', () => {
    it('管理者のロールを再保存しても所属を維持する', async () => {
        const updateRole = jest
            .fn<IUserRepository['updateRole']>()
            .mockResolvedValue(mockUser);
        const repo = createMockRepo({
            findById: async () => ({ ...mockUser, role: 'admin' }),
            updateRole,
        });
        expect(
            await new UpdateUserRoleUseCase(repo, departmentRepository).execute(
                { id: mockUser.id, role: 'admin' },
            ),
        ).toEqual({ success: true });
        expect(updateRole).toHaveBeenCalledWith(
            mockUser.id,
            'admin',
            undefined,
        );
    });
    it('管理者への昇格時は従来通り所属を解除する', async () => {
        const updateRole = jest
            .fn<IUserRepository['updateRole']>()
            .mockResolvedValue(mockUser);
        await new UpdateUserRoleUseCase(
            createMockRepo({ updateRole }),
            departmentRepository,
        ).execute({ id: mockUser.id, role: 'admin' });
        expect(updateRole).toHaveBeenCalledWith(mockUser.id, 'admin', null);
    });
    it.each(['department', 'user'])(
        '%sの事前検索の例外を結果型で返す',
        async (stage) => {
            const fail = async (): Promise<never> => {
                throw new Error('offline');
            };
            const users = createMockRepo(
                stage === 'user' ? { findById: fail } : {},
            );
            const departments = {
                ...departmentRepository,
                ...(stage === 'department' ? { findById: fail } : {}),
            };
            expect(
                await new UpdateUserRoleUseCase(users, departments).execute({
                    id: mockUser.id,
                    role: 'user',
                    departmentId: mockUser.departmentId!,
                }),
            ).toMatchObject({ success: false, status: 500 });
        },
    );
});

it('管理者への変更時に明示した有効な部署を反映する',async()=>{
 const updateRole=jest.fn<IUserRepository['updateRole']>().mockResolvedValue(mockUser);
 const result=await new UpdateUserRoleUseCase(createMockRepo({updateRole}),departmentRepository).execute({id:mockUser.id,role:'admin',departmentId:mockUser.departmentId!});
 expect(result.success).toBe(true);
 expect(updateRole).toHaveBeenCalledWith(mockUser.id,'admin',mockUser.departmentId);
});
