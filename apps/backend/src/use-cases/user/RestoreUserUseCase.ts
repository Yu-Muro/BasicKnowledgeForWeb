import type { IDepartmentRepository } from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';
import type { IUserRepository } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import type {
    IRestoreUserUseCase,
    RestoreUserResult,
} from './IRestoreUserUseCase';
export class RestoreUserUseCase implements IRestoreUserUseCase {
    constructor(
        private readonly users: IUserRepository,
        private readonly departments: IDepartmentRepository,
    ) {}
    async execute(
        id: string,
        departmentId?: string,
    ): Promise<RestoreUserResult> {
        try {
            const user = await this.users.findById(id, true);
            if (!user)
                return {
                    success: false,
                    error: 'ユーザーが見つかりません',
                    status: 404,
                };
            if (!user.deletedAt)
                return {
                    success: false,
                    error: 'このユーザーは削除されていません',
                    status: 409,
                };
            if (user.role !== 'admin' && !departmentId)
                return {
                    success: false,
                    error: '一般ユーザーには部署を指定してください',
                    status: 400,
                };
            if (
                departmentId &&
                !(await this.departments.findById(departmentId))
            )
                return {
                    success: false,
                    error: '有効な部署を指定してください',
                    status: 400,
                };
            const restored = await this.users.restore(id, departmentId ?? null);
            if (!restored)
                return {
                    success: false,
                    error: 'ユーザーは既に復元されているか削除されています',
                    status: 409,
                };
            const {
                password: _password,
                sessionVersion: _version,
                ...data
            } = restored;
            return { success: true, data };
        } catch {
            return {
                success: false,
                error: 'ユーザーの復元に失敗しました',
                status: 500,
            };
        }
    }
}
