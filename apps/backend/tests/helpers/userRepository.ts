import type {
    IUserRepository,
    User,
} from '@backend/src/infrastructure/repositories/user/IUserRepository';
export const user: User = {
    id: 'abcdefab-0000-4000-8000-000000000001',
    name: 'テスト',
    email: 'user@test.com',
    password: 'hash',
    role: 'user',
    departmentId: '60000000-0000-4000-8000-000000000001',
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
};
export function userRepository(
    overrides: Partial<IUserRepository> = {},
): IUserRepository {
    return {
        findAll: async () => [user],
        findById: async () => user,
        findByEmail: async () => user,
        create: async () => user,
        updateRole: async () => user,
        updateDepartment: async () => user,
        softDelete: async () => true,
        updatePassword: async () => {},
        ...overrides,
    };
}
