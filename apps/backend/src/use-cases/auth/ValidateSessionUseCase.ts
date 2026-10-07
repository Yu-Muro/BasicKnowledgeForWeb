import type { IUserRepository } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import type {
    IValidateSessionUseCase,
    SessionResult,
    SessionUser,
} from './IValidateSessionUseCase';
import { sessionUserError } from './sessionUserError';
export class ValidateSessionUseCase implements IValidateSessionUseCase {
    constructor(private readonly users: IUserRepository) {}
    async execute(claims: SessionUser): Promise<SessionResult> {
        try {
            const user = await this.users.findById(claims.id);
            const error = sessionUserError(user);
            if (error) return { success: false, ...error };
            if (!user)
                return { success: false, error: 'Unauthorized', status: 401 };
            if ((claims.sessionVersion ?? 0) !== user.sessionVersion)
                return {
                    success: false,
                    error: '再ログインしてください',
                    status: 401,
                };
            return {
                success: true,
                data: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    departmentId: user.departmentId,
                },
            };
        } catch {
            return {
                success: false,
                error: '認証情報の確認に失敗しました',
                status: 503,
            };
        }
    }
}
