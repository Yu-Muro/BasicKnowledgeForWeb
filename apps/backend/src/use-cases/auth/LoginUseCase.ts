import type { IAuthenticationRepository } from '../../infrastructure/repositories/auth/IAuthenticationRepository';
import type { ILoginUseCase, LoginInput, LoginResult } from './ILoginUseCase';

export class LoginUseCase implements ILoginUseCase {
    constructor(private readonly authentication: IAuthenticationRepository) {}
    async execute(input: LoginInput): Promise<LoginResult> {
        try {
            const response = await this.authentication.signIn(
                input.email,
                input.password,
                input.headers,
            );
            if (!response.ok) {
                if (response.status >= 500) {
                    return {
                        success: false,
                        status: 503,
                        error: 'ログイン処理中にエラーが発生しました',
                    };
                }
                const body = (await response.json()) as { message?: string };
                return {
                    success: false,
                    status:
                        response.status === 429
                            ? 429
                            : response.status === 403
                              ? 403
                              : 401,
                    error:
                        response.status === 429
                            ? '試行回数が多すぎます。しばらくしてから再試行してください'
                            : body.message ===
                                '所属部署が未設定です。管理者に設定を依頼してください'
                              ? body.message
                              : 'メールアドレスまたはパスワードが正しくありません',
                };
            }
            return {
                success: true,
                data: { cookies: response.headers.getSetCookie() },
            };
        } catch {
            return {
                success: false,
                error: 'ログイン処理中にエラーが発生しました',
                status: 503,
            };
        }
    }
}
