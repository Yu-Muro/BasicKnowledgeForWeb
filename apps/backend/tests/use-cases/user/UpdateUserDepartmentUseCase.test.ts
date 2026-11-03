import { UpdateUserDepartmentUseCase } from '@backend/src/use-cases/user/UpdateUserDepartmentUseCase';
import { describe, expect, it, jest } from '@jest/globals';
import {
    department,
    departmentRepository,
} from '../../helpers/departmentRepository';
import { user, userRepository } from '../../helpers/userRepository';

describe('UpdateUserDepartmentUseCase', () => {
    it('存在する部署へ所属を変更する', async () => {
        const updateDepartment = jest
            .fn<
                (
                    id: string,
                    departmentId: string,
                ) => Promise<typeof user | null>
            >()
            .mockResolvedValue(user);
        expect(
            await new UpdateUserDepartmentUseCase(
                userRepository({ updateDepartment }),
                departmentRepository,
            ).execute(user.id, department.id),
        ).toEqual({ success: true });
        expect(updateDepartment).toHaveBeenCalledWith(user.id, department.id);
    });
    it('部署なしでは更新しない', async () => {
        const updateDepartment =
            jest.fn<
                (
                    id: string,
                    departmentId: string,
                ) => Promise<typeof user | null>
            >();
        expect(
            await new UpdateUserDepartmentUseCase(
                userRepository({ updateDepartment }),
                { ...departmentRepository, findById: async () => null },
            ).execute(user.id, department.id),
        ).toMatchObject({ success: false, status: 400 });
        expect(updateDepartment).not.toHaveBeenCalled();
    });
    it('対象ユーザーなしを404にする', async () => {
        expect(
            await new UpdateUserDepartmentUseCase(
                userRepository({ updateDepartment: async () => null }),
                departmentRepository,
            ).execute(user.id, department.id),
        ).toMatchObject({ success: false, status: 404 });
    });
    it.each(['lookup', 'update'])('%sの例外を結果型で返す', async (stage) => {
        const fail = async (): Promise<never> => {
            throw new Error('offline');
        };
        const users = userRepository(
            stage === 'update' ? { updateDepartment: fail } : {},
        );
        const departments = {
            ...departmentRepository,
            ...(stage === 'lookup' ? { findById: fail } : {}),
        };
        expect(
            await new UpdateUserDepartmentUseCase(users, departments).execute(
                user.id,
                department.id,
            ),
        ).toMatchObject({ success: false, status: 500 });
    });
});
