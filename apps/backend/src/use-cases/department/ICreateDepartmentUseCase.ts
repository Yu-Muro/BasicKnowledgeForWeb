import type { Department } from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';

export type CreateDepartmentInput = {
    name: string;
};

export type CreateDepartmentResult =
    | { success: true; data: Department }
    | { success: false; error: string; status?: number };

export interface ICreateDepartmentUseCase {
    execute(input: CreateDepartmentInput): Promise<CreateDepartmentResult>;
}
