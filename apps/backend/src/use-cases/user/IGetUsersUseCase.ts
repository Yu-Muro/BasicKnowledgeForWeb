import type { UserPublic } from '@backend/src/infrastructure/repositories/user/IUserRepository';

export interface IGetUsersUseCase {
    execute(
        deleted?: boolean,
    ): Promise<
        | { success: true; data: UserPublic[] }
        | { success: false; error: string }
    >;
}
