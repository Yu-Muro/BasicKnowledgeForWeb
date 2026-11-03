export type DeleteDepartmentInput = {
    id: string;
};

export type DeleteDepartmentResult =
    | { success: true; data: { id: string } }
    | { success: false; error: string; status?: number };

export interface IDeleteDepartmentUseCase {
    execute(input: DeleteDepartmentInput): Promise<DeleteDepartmentResult>;
}
