export type UpdateUserDepartmentResult =
    | { success: true }
    | { success: false; error: string; status: 400 | 404 | 500 };
export interface IUpdateUserDepartmentUseCase {
    execute(
        id: string,
        departmentId: string,
    ): Promise<UpdateUserDepartmentResult>;
}
