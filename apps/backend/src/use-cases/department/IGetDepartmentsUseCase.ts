import type { Department } from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';

export type GetDepartmentsResult =
    | { success: true; data: Department[] }
    | { success: false; error: string; status?: number };

export interface IGetDepartmentsUseCase {
    execute(): Promise<GetDepartmentsResult>;
}
