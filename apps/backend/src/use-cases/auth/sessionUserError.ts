import type { User } from '@backend/src/infrastructure/repositories/user/IUserRepository';
export function sessionUserError(
    user: User | null,
): { error: string; status: 401 | 403 } | null {
    if (!user || user.deletedAt) return { error: 'Unauthorized', status: 401 };
    if (user.role !== 'admin' && !user.departmentId)
        return {
            error: '所属部署が未設定です。管理者に設定を依頼してください',
            status: 403,
        };
    return null;
}
