export type DeleteUserResult =
    | { success: true }
    | { success: false; error: string; status: 400 | 404 | 500 };
export interface IDeleteUserUseCase {
    execute(id: string, actorId: string): Promise<DeleteUserResult>;
}
