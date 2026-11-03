import type { createDatabaseClient } from '@backend/src/db/connection';
import { sql } from 'drizzle-orm';
import type { IMigrationStateRepository } from './IMigrationStateRepository';
export class MigrationStateRepository implements IMigrationStateRepository {
    constructor(
        private readonly db: Omit<
            ReturnType<typeof createDatabaseClient>,
            '$client'
        >,
        private readonly completion = { complete: false },
    ) {}
    async isDepartmentMigrationPending(): Promise<boolean> {
        if (this.completion.complete) return false;
        const result = await this.db.execute(
            sql`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='departments' AND column_name='event_id') AS pending`,
        );
        const pending = result.rows[0]?.pending;
        if (typeof pending !== 'boolean')
            throw new Error('移行状態を確認できませんでした');
        if (!pending) this.completion.complete = true;
        return pending;
    }
}
