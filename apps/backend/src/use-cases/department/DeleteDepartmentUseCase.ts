import type { IDepartmentRepository } from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';
import type {
    DeleteDepartmentInput,
    DeleteDepartmentResult,
    IDeleteDepartmentUseCase,
} from './IDeleteDepartmentUseCase';

function isForeignKeyViolation(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes('foreign key') || msg.includes('SQLSTATE 23503');
}

export class DeleteDepartmentUseCase implements IDeleteDepartmentUseCase {
    constructor(private readonly departmentRepository: IDepartmentRepository) {}

    async execute(
        input: DeleteDepartmentInput,
    ): Promise<DeleteDepartmentResult> {
        try {
            const deleted = await this.departmentRepository.delete(
                input.id,
                input.eventId,
            );
            if (!deleted) {
                return {
                    success: false,
                    error: '部署が見つかりません',
                    status: 404,
                };
            }
            return { success: true, data: { id: input.id } };
        } catch (err) {
            if (isForeignKeyViolation(err)) {
                return {
                    success: false,
                    error: 'この部署は部屋割りまたはタイムテーブルで使用されているため削除できません',
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
