import type { UserPublic } from '@backend/src/infrastructure/repositories/user/IUserRepository';
export type RestoreUserResult =
    | { success: true; data: UserPublic }
    | { success: false; error: string; status: 400 | 404 | 409 | 500 };
export interface IRestoreUserUseCase {
    execute(id: string, departmentId?: string): Promise<RestoreUserResult>;
}
