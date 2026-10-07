import { CheckDepartmentWritesUseCase } from '@backend/src/use-cases/department/CheckDepartmentWritesUseCase';
import { CreateDepartmentUseCase } from '@backend/src/use-cases/department/CreateDepartmentUseCase';
import { UpdateDepartmentUseCase } from '@backend/src/use-cases/department/UpdateDepartmentUseCase';
import { describe, expect, it, jest } from '@jest/globals';
import {
    department,
    departmentRepository,
} from '../../helpers/departmentRepository';

describe('部署の重複と移行中の書き込み', () => {
    it('同名の作成はDBへの挿入前に409で拒否する', async () => {
        const create = jest.fn<typeof departmentRepository.create>();
        expect(
            await new CreateDepartmentUseCase({
                ...departmentRepository,
                create,
            }).execute({ name: department.name }),
        ).toMatchObject({ success: false, status: 409 });
        expect(create).not.toHaveBeenCalled();
    });
    it('別部署と同名に改名することを拒否する', async () => {
        const update = jest.fn<typeof departmentRepository.update>();
        expect(
            await new UpdateDepartmentUseCase({
                ...departmentRepository,
                update,
            }).execute({ id: 'other', payload: { name: department.name } }),
        ).toMatchObject({ success: false, status: 409 });
        expect(update).not.toHaveBeenCalled();
    });
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
});
