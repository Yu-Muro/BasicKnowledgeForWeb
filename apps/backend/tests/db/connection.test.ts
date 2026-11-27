import { createDatabaseClient, type Env } from '@backend/src/db/connection';
import { expect, it } from '@jest/globals';

it('検索の5クエリを並列接続でき、接続待ち時間を制限する', async () => {
    const db = createDatabaseClient({
        HYPERDRIVE: { connectionString: 'postgresql://localhost/test' },
    } as Env);
    try {
        expect(db.$client.options.max).toBe(5);
        expect(db.$client.options.connectionTimeoutMillis).toBe(5_000);
    } finally {
        await db.$client.end();
    }
});
