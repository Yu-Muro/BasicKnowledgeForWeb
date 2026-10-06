import type { IAuthenticationRepository } from '../../infrastructure/repositories/auth/IAuthenticationRepository';

export interface ILogoutUseCase {
    execute(
        headers: Headers,
    ): Promise<
        | { success: true; data: { cookies: string[] } }
        | { success: false; error: string }
    >;
}
export class LogoutUseCase implements ILogoutUseCase {
    constructor(private readonly authentication: IAuthenticationRepository) {}
    async execute(headers: Headers): ReturnType<ILogoutUseCase['execute']> {
        try {
            const response = await this.authentication.signOut(headers);
            if (!response.ok)
                return { success: false, error: 'ログアウトに失敗しました' };
            return {
                success: true,
                data: { cookies: response.headers.getSetCookie() },
            };
        } catch {
            return { success: false, error: 'ログアウトに失敗しました' };
        }
    }
}
