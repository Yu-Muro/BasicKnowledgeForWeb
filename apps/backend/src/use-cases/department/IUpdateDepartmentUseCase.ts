import type { Department } from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';

export type UpdateDepartmentInput = {
    id: string;
    payload: { name?: string };
};

export type UpdateDepartmentResult =
    | { success: true; data: Department }
    | { success: false; error: string; status?: number };

export interface IUpdateDepartmentUseCase {
    execute(input: UpdateDepartmentInput): Promise<UpdateDepartmentResult>;
}
