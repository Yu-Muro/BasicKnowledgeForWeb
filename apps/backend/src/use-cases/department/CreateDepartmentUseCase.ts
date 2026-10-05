import type { IDepartmentRepository } from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';
import type {
    CreateDepartmentInput,
    CreateDepartmentResult,
    ICreateDepartmentUseCase,
} from './ICreateDepartmentUseCase';

export class CreateDepartmentUseCase implements ICreateDepartmentUseCase {
    constructor(private readonly departmentRepository: IDepartmentRepository) {}

    async execute(
        input: CreateDepartmentInput,
    ): Promise<CreateDepartmentResult> {
        try {
            const data = await this.departmentRepository.create({
                name: input.name,
            });
            return { success: true, data };
        } catch {
            return {
                success: false,
                error: '部署の作成中にエラーが発生しました',
                status: 500,
            };
        }
    }
}
