import type { IDepartmentRepository } from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';
import type { IUserRepository } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import type {
    IUpdateUserDepartmentUseCase,
    UpdateUserDepartmentResult,
} from './IUpdateUserDepartmentUseCase';
export class UpdateUserDepartmentUseCase
    implements IUpdateUserDepartmentUseCase
{
    constructor(
        private readonly users: IUserRepository,
        private readonly departments: IDepartmentRepository,
    ) {}
    async execute(
        id: string,
        departmentId: string,
    ): Promise<UpdateUserDepartmentResult> {
        try {
            if (!(await this.departments.findById(departmentId)))
                return {
                    success: false,
                    error: '部署が見つかりません',
                    status: 400,
                };
            return (await this.users.updateDepartment(id, departmentId))
                ? { success: true }
                : {
                      success: false,
                      error: 'ユーザーが見つかりません',
                      status: 404,
                  };
        } catch {
            return {
                success: false,
                error: '所属部署の更新に失敗しました',
                status: 500,
            };
        }
    }
}
