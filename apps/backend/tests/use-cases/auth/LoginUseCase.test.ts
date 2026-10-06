import type { IAuthenticationRepository } from '@backend/src/infrastructure/repositories/auth/IAuthenticationRepository';
import { LoginUseCase } from '@backend/src/use-cases/auth/LoginUseCase';
import { describe, expect, it, jest } from '@jest/globals';

describe('LoginUseCase', () => {
    it('認証サービスの障害をパスワード不一致として返さない', async () => {
        const authentication: IAuthenticationRepository = {
            signIn: jest
                .fn<IAuthenticationRepository['signIn']>()
                .mockResolvedValue(
                    new Response('unavailable', { status: 500 }),
                ),
            signOut: jest.fn<IAuthenticationRepository['signOut']>(),
            getSessionUserId:
                jest.fn<IAuthenticationRepository['getSessionUserId']>(),
        };
        const result = await new LoginUseCase(authentication).execute({
            email: 'user@example.com',
            password: 'password123',
            headers: new Headers(),
        });
        expect(result).toEqual({
            success: false,
            status: 503,
            error: 'ログイン処理中にエラーが発生しました',
        });
    });
});
