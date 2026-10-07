import type { IDepartmentRepository } from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';
import type { IUserRepository } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import type {
    IUpdateUserRoleUseCase,
    UpdateUserRoleInput,
    UpdateUserRoleResult,
} from './IUpdateUserRoleUseCase';

export class UpdateUserRoleUseCase implements IUpdateUserRoleUseCase {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly departmentRepository: IDepartmentRepository,
    ) {}

    async execute(input: UpdateUserRoleInput): Promise<UpdateUserRoleResult> {
        try {
            if (
                (input.role !== 'admin' || input.departmentId !== undefined) &&
                (!input.departmentId ||
                    !(await this.departmentRepository.findById(
                        input.departmentId,
                    )))
            )
                return {
                    success: false,
                    error: '有効な部署を指定してください',
                    status: 400,
                };
            const existing = await this.userRepository.findById(input.id);
            if (!existing) {
                return {
                    success: false,
                    error: 'ユーザーが見つかりません',
                    status: 404,
                };
            }

            const updated = await this.userRepository.updateRole(
                input.id,
                input.role,
                input.role === 'admin'
                    ? (input.departmentId ??
                          (existing.role === 'admin' ? undefined : null))
                    : input.departmentId,
            );
            if (!updated) {
                return {
                    success: false,
                    error: 'ユーザーが見つかりません',
                    status: 404,
                };
            }
            return { success: true };
        } catch {
            return {
                success: false,
                error: 'ロールの更新に失敗しました',
                status: 500,
            };
        }
    }
}
