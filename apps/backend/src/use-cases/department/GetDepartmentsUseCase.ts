import type { IDepartmentRepository } from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';
import type {
    GetDepartmentsResult,
    IGetDepartmentsUseCase,
} from './IGetDepartmentsUseCase';

export class GetDepartmentsUseCase implements IGetDepartmentsUseCase {
    constructor(private readonly departmentRepository: IDepartmentRepository) {}

    async execute(): Promise<GetDepartmentsResult> {
        try {
            const data = await this.departmentRepository.findAll();
            return { success: true, data };
        } catch {
            return {
                success: false,
                error: '部署一覧の取得中にエラーが発生しました',
                status: 500,
            };
        }
    }
}
