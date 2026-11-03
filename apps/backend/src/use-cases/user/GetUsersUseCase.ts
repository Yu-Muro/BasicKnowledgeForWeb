import type { IUserRepository } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import type { IGetUsersUseCase } from './IGetUsersUseCase';

export class GetUsersUseCase implements IGetUsersUseCase {
    constructor(private readonly userRepository: IUserRepository) {}

    async execute(deleted = false) {
        try {
            const allUsers = await this.userRepository.findAll(deleted);
            const usersPublic = allUsers.map(
                ({ password: _pw, sessionVersion: _version, ...rest }) => rest,
            );
            return { success: true as const, data: usersPublic };
        } catch (error) {
            return {
                success: false as const,
                error:
                    error instanceof Error
                        ? error.message
                        : 'ユーザーの取得に失敗しました',
            };
        }
    }
}
