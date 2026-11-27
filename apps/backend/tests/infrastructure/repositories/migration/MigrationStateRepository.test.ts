import { MigrationStateRepository } from '@backend/src/infrastructure/repositories/migration/MigrationStateRepository';
import { describe, expect, it, jest } from '@jest/globals';
type Database = ConstructorParameters<typeof MigrationStateRepository>[0];
describe('部署移行完了状態の共有', () => {
    it('未完了は毎回照会し、完了後は別リクエストのリポジトリでも再照会しない', async () => {
        const state = { complete: false };
        const execute = jest
            .fn<() => Promise<{ rows: { pending: boolean }[] }>>()
            .mockResolvedValueOnce({ rows: [{ pending: true }] })
            .mockResolvedValueOnce({ rows: [{ pending: false }] });
        const repository = new MigrationStateRepository(
            { execute } as unknown as Database,
            state,
        );
        expect(await repository.isDepartmentMigrationPending()).toBe(true);
        expect(await repository.isDepartmentMigrationPending()).toBe(false);
        const other = jest.fn();
        expect(
            await new MigrationStateRepository(
                { execute: other } as unknown as Database,
                state,
            ).isDepartmentMigrationPending(),
        ).toBe(false);
        expect(execute).toHaveBeenCalledTimes(2);
        expect(other).not.toHaveBeenCalled();
    });
    it('異なるWorkerの状態と混同しない', async () => {
        const execute = jest
            .fn<() => Promise<{ rows: { pending: boolean }[] }>>()
            .mockResolvedValue({ rows: [{ pending: true }] });
        expect(
            await new MigrationStateRepository(
                { execute } as unknown as Database,
                { complete: false },
            ).isDepartmentMigrationPending(),
        ).toBe(true);
    });
    it('取得失敗や不正な応答を完了扱いにしない', async () => {
        const state = { complete: false };
        const execute = jest
            .fn<() => Promise<{ rows: object[] }>>()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce({ rows: [] });
        const repository = new MigrationStateRepository(
            { execute } as unknown as Database,
            state,
        );
        await expect(repository.isDepartmentMigrationPending()).rejects.toThrow(
            'offline',
        );
        await expect(repository.isDepartmentMigrationPending()).rejects.toThrow(
            '移行状態',
        );
        expect(state.complete).toBe(false);
    });
});
