import type { IDepartmentRepository } from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';
import { hasDatabaseError } from '../databaseErrors';
import type {
    IUpdateDepartmentUseCase,
    UpdateDepartmentInput,
    UpdateDepartmentResult,
} from './IUpdateDepartmentUseCase';

export class UpdateDepartmentUseCase implements IUpdateDepartmentUseCase {
    constructor(private readonly departmentRepository: IDepartmentRepository) {}

    async execute(
        input: UpdateDepartmentInput,
    ): Promise<UpdateDepartmentResult> {
        try {
            const data = await this.departmentRepository.update(
                input.id,
                input.payload,
            );
            if (!data) {
                return {
                    success: false,
                    error: '部署が見つかりません',
                    status: 404,
                };
            }
            return { success: true, data };
        } catch (error) {
            if (hasDatabaseError(error, '23505'))
                return {
                    success: false,
                    error: '同じ名前の部署が既に存在します',
                    status: 409,
                };
            return {
                success: false,
                error: '部署の更新中にエラーが発生しました',
                status: 500,
            };
        }
    }
}
