import type { departments } from '@backend/src/db/schema';
export type Department = typeof departments.$inferSelect;
export type CreateDepartmentInput = { name: string };
export type UpdateDepartmentInput = { name?: string };
export interface IDepartmentRepository {
    findAll(): Promise<Department[]>;
    findById(id: string): Promise<Department | null>;
    create(input: CreateDepartmentInput): Promise<Department>;
    update(
        id: string,
        input: UpdateDepartmentInput,
    ): Promise<Department | null>;
    delete(id: string): Promise<boolean>;
}
