import type { IUserRepository } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import { compare } from 'bcryptjs';
import { sign } from 'hono/jwt';
import type { ILoginUseCase, LoginInput, LoginResult } from './ILoginUseCase';
import { sessionUserError } from './sessionUserError';

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

            const error = sessionUserError(user);
            if (error) return { success: false, error: error.error };
            const exp = Math.floor(Date.now() / 1000) + TOKEN_EXPIRE_SECONDS;
            const token = await sign(
                {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    departmentId: user.departmentId,
                    sessionVersion: user.sessionVersion,
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
