import { CheckDepartmentWritesUseCase } from '@backend/src/use-cases/department/CheckDepartmentWritesUseCase';
import { CreateDepartmentUseCase } from '@backend/src/use-cases/department/CreateDepartmentUseCase';
import { DeleteDepartmentUseCase } from '@backend/src/use-cases/department/DeleteDepartmentUseCase';
import { UpdateDepartmentUseCase } from '@backend/src/use-cases/department/UpdateDepartmentUseCase';
import { describe, expect, it, jest } from '@jest/globals';
import {
    department,
    departmentRepository,
} from '../../helpers/departmentRepository';

describe('部署の重複と移行中の書き込み', () => {
    it.each(['create', 'update'])(
        '並行%sの一意制約違反も409にする',
        async (operation) => {
            const fail = async (): Promise<never> => {
                throw { cause: { code: '23505' } };
            };
            const repo = {
                ...departmentRepository,
                findAll: async () => [],
                create: fail,
                update: fail,
            };
            const result =
                operation === 'create'
                    ? await new CreateDepartmentUseCase(repo).execute({
                          name: '新部署',
                      })
                    : await new UpdateDepartmentUseCase(repo).execute({
                          id: department.id,
                          payload: { name: '新部署' },
                      });
            expect(result).toMatchObject({ success: false, status: 409 });
        },
    );
    it('移行中の書き込みを503にする', async () => {
        expect(
            await new CheckDepartmentWritesUseCase({
                isDepartmentMigrationPending: async () => true,
            }).execute(),
        ).toMatchObject({ success: false, status: 503 });
    });
    it('移行完了後は書き込みを許可する', async () => {
        expect(
            await new CheckDepartmentWritesUseCase({
                isDepartmentMigrationPending: async () => false,
            }).execute(),
        ).toEqual({ success: true });
    });
    it('移行状態の取得失敗でも書き込みを通さない', async () => {
        expect(
            await new CheckDepartmentWritesUseCase({
                isDepartmentMigrationPending: async () => {
                    throw new Error('offline');
                },
            }).execute(),
        ).toMatchObject({ success: false, status: 503 });
    });
    it.each(['create', 'update'])(
        '部署%sでは全件読み込みを行わない',
        async (operation) => {
            const findAll = jest.fn<typeof departmentRepository.findAll>();
            const repo = { ...departmentRepository, findAll };
            const result =
                operation === 'create'
                    ? await new CreateDepartmentUseCase(repo).execute({
                          name: '総務',
                      })
                    : await new UpdateDepartmentUseCase(repo).execute({
                          id: department.id,
                          payload: { name: '総務' },
                      });
            expect(result.success).toBe(true);
            expect(findAll).not.toHaveBeenCalled();
        },
    );
    it.each([
        { code: '23503' },
        { cause: { cause: { message: 'SQLSTATE 23503' } } },
        { cause: new Error('foreign key violation') },
    ])('部署削除のネストしたFKエラーを409にする', async (error) => {
        const result = await new DeleteDepartmentUseCase({
            ...departmentRepository,
            delete: async () => {
                throw error;
            },
        }).execute({ id: department.id });
        expect(result).toMatchObject({ success: false, status: 409 });
    });
});
