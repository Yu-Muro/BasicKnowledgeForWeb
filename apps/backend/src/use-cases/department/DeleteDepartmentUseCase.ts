import type { IDepartmentRepository } from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';
import { hasDatabaseError } from '../databaseErrors';
import type {
    DeleteDepartmentInput,
    DeleteDepartmentResult,
    IDeleteDepartmentUseCase,
} from './IDeleteDepartmentUseCase';

export class DeleteDepartmentUseCase implements IDeleteDepartmentUseCase {
    constructor(private readonly departmentRepository: IDepartmentRepository) {}

    async execute(
        input: DeleteDepartmentInput,
    ): Promise<DeleteDepartmentResult> {
        try {
            const deleted = await this.departmentRepository.delete(input.id);
            if (!deleted) {
                return {
                    success: false,
                    error: '部署が見つかりません',
                    status: 404,
                };
            }
            return { success: true, data: { id: input.id } };
        } catch (err) {
            if (hasDatabaseError(err, '23503')) {
                return {
                    success: false,
                    error: 'この部署はユーザー・部屋割り・タイムテーブルで使用されているため削除できません',
                    status: 409,
                };
            }
            return {
                success: false,
                error: '部署の削除中にエラーが発生しました',
                status: 500,
            };
        }
    }
}
