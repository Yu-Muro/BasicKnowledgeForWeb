import { DeleteUserUseCase } from '@backend/src/use-cases/user/DeleteUserUseCase';
import { describe, expect, it, jest } from '@jest/globals';
import { user, userRepository } from '../../helpers/userRepository';

describe('DeleteUserUseCase', () => {
    it('大文字・小文字の自己IDを拒否してDBを変更しない', async () => {
        const softDelete = jest.fn<() => Promise<boolean>>();
        expect(
            await new DeleteUserUseCase(userRepository({ softDelete })).execute(
                user.id.toUpperCase(),
                user.id,
            ),
        ).toMatchObject({ success: false, status: 400 });
        expect(softDelete).not.toHaveBeenCalled();
    });
    it('他のユーザーを削除する', async () => {
        expect(
            await new DeleteUserUseCase(userRepository()).execute(
                user.id,
                'other',
            ),
        ).toEqual({ success: true });
    });
    it('存在しない・削除済みユーザーを404にする', async () => {
        expect(
            await new DeleteUserUseCase(
                userRepository({ softDelete: async () => false }),
            ).execute(user.id, 'other'),
        ).toMatchObject({ success: false, status: 404 });
    });
    it('DB例外を結果型で返す', async () => {
        expect(
            await new DeleteUserUseCase(
                userRepository({
                    softDelete: async () => {
                        throw new Error('offline');
                    },
                }),
            ).execute(user.id, 'other'),
        ).toMatchObject({ success: false, status: 500 });
    });
});
