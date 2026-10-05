import type { IDepartmentRepository } from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';
import type {
    DeleteDepartmentInput,
    DeleteDepartmentResult,
    IDeleteDepartmentUseCase,
} from './IDeleteDepartmentUseCase';

function isForeignKeyViolation(err: unknown): boolean {
    let current = err;
    for (
        let depth = 0;
        depth < 5 && current && typeof current === 'object';
        depth++
    ) {
        const error = current as {
            code?: string;
            message?: string;
            cause?: unknown;
        };
        if (
            error.code === '23503' ||
            error.message?.includes('foreign key') ||
            error.message?.includes('SQLSTATE 23503')
        )
            return true;
        current = error.cause;
    }
    return false;
}

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
            if (isForeignKeyViolation(err)) {
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
