import type { IDepartmentRepository } from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';
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
        } catch {
            return {
                success: false,
                error: '部署の更新中にエラーが発生しました',
                status: 500,
            };
        }
    }
}
