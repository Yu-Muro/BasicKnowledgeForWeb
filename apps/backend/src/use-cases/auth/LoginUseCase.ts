import type { IUserRepository } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import { compare } from 'bcryptjs';
import { sign } from 'hono/jwt';
import type { ILoginUseCase, LoginInput, LoginResult } from './ILoginUseCase';

const TOKEN_EXPIRE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export class LoginUseCase implements ILoginUseCase {
    constructor(private readonly userRepository: IUserRepository) {}

    async execute(input: LoginInput): Promise<LoginResult> {
        try {
            const user = await this.userRepository.findByEmail(input.email);
            if (!user || user.deletedAt !== null) {
                return {
                    success: false,
                    error: 'メールアドレスまたはパスワードが正しくありません',
                };
            }

            const passwordMatch = await compare(input.password, user.password);
            if (!passwordMatch) {
                return {
                    success: false,
                    error: 'メールアドレスまたはパスワードが正しくありません',
                };
            }

            if (user.role !== 'admin' && !user.departmentId)
                return {
                    success: false,
                    error: '所属部署が未設定です。管理者に設定を依頼してください',
                };
            const exp = Math.floor(Date.now() / 1000) + TOKEN_EXPIRE_SECONDS;
            const token = await sign(
                {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    departmentId: user.departmentId,
                    exp,
                },
                input.jwtSecret,
            );

            return { success: true, token };
        } catch {
            return {
                success: false,
                error: 'ログイン処理中にエラーが発生しました',
            };
        }
    }
}
