import type { IMigrationStateRepository } from '@backend/src/infrastructure/repositories/migration/IMigrationStateRepository';
import type {
    DepartmentWriteResult,
    ICheckDepartmentWritesUseCase,
} from './ICheckDepartmentWritesUseCase';
export class CheckDepartmentWritesUseCase
    implements ICheckDepartmentWritesUseCase
{
    constructor(private readonly migrations: IMigrationStateRepository) {}
    async execute(): Promise<DepartmentWriteResult> {
        try {
            if (await this.migrations.isDepartmentMigrationPending())
                return {
                    success: false,
                    error: '部署データを移行中です。完了後にもう一度お試しください',
                    status: 503,
                };
            return { success: true };
        } catch {
            return {
                success: false,
                error: '部署データの移行状態を確認できませんでした',
                status: 503,
            };
        }
    }
}
