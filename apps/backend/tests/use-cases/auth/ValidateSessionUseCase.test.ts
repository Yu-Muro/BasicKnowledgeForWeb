import { ValidateSessionUseCase } from '@backend/src/use-cases/auth/ValidateSessionUseCase';
import { describe, expect, it } from '@jest/globals';
import { user, userRepository } from '../../helpers/userRepository';

describe('ValidateSessionUseCase', () => {
    it('JWTの古い管理者ロールや部署を現在のDB値に置き換える', async () => {
        const result = await new ValidateSessionUseCase(
            userRepository(),
        ).execute({ ...user, role: 'admin', departmentId: 'old' });
        expect(result).toMatchObject({
            success: true,
            data: { role: 'user', departmentId: user.departmentId },
        });
        if (result.success) expect(result.data).not.toHaveProperty('password');
    });
    it.each([null, { ...user, deletedAt: new Date() }])(
        '存在しない・削除済みユーザーを拒否する',
        async (current) => {
            expect(
                await new ValidateSessionUseCase(
                    userRepository({ findById: async () => current }),
                ).execute(user),
            ).toMatchObject({ success: false, status: 401 });
        },
    );
    it('所属のない一般ユーザーを拒否する', async () => {
        expect(
            await new ValidateSessionUseCase(
                userRepository({
                    findById: async () => ({ ...user, departmentId: null }),
                }),
            ).execute(user),
        ).toMatchObject({ success: false, status: 403 });
    });
    it('管理者は所属なしで利用できる', async () => {
        expect(
            await new ValidateSessionUseCase(
                userRepository({
                    findById: async () => ({
                        ...user,
                        role: 'admin',
                        departmentId: null,
                    }),
                }),
            ).execute(user),
        ).toMatchObject({ success: true });
    });
    it('DB例外時は認証を通さない', async () => {
        expect(
            await new ValidateSessionUseCase(
                userRepository({
                    findById: async () => {
                        throw new Error('offline');
                    },
                }),
            ).execute(user),
        ).toMatchObject({ success: false, status: 503 });
    });
});
