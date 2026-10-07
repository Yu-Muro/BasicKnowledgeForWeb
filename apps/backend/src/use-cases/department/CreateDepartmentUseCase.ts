import type { IDepartmentRepository } from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';
import { hasDatabaseError } from '../databaseErrors';
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
            if (
                (await this.departmentRepository.findAll()).some(
                    (department) => department.name === input.name,
                )
            )
                return {
                    success: false,
                    error: '同じ名前の部署が既に存在します',
                    status: 409,
                };

            const data = await this.departmentRepository.create({
                name: input.name,
            });
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
                error: '部署の作成中にエラーが発生しました',
                status: 500,
            };
        }
    }
}
