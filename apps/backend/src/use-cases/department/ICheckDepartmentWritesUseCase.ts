export type DepartmentWriteResult =
    | { success: true }
    | { success: false; error: string; status: 503 };
export interface ICheckDepartmentWritesUseCase {
    execute(): Promise<DepartmentWriteResult>;
}
