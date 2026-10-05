import type { IUserRepository } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import type {
    DeleteUserResult,
    IDeleteUserUseCase,
} from './IDeleteUserUseCase';
export class DeleteUserUseCase implements IDeleteUserUseCase {
    constructor(private readonly repository: IUserRepository) {}
    async execute(id: string, actorId: string): Promise<DeleteUserResult> {
        if (id === actorId)
            return {
                success: false,
                error: '自分自身は削除できません',
                status: 400,
            };
        try {
            return (await this.repository.softDelete(id))
                ? { success: true }
                : {
                      success: false,
                      error: 'ユーザーが見つかりません',
                      status: 404,
                  };
        } catch {
            return {
                success: false,
                error: 'ユーザーの削除に失敗しました',
                status: 500,
            };
        }
    }
}
