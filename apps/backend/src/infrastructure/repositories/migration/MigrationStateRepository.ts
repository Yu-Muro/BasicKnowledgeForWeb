import type { createDatabaseClient } from '@backend/src/db/connection';
import { sql } from 'drizzle-orm';
import type { IMigrationStateRepository } from './IMigrationStateRepository';
export class MigrationStateRepository implements IMigrationStateRepository {
    constructor(
        private readonly db: Omit<
            ReturnType<typeof createDatabaseClient>,
            '$client'
        >,
    ) {}
    async isDepartmentMigrationPending(): Promise<boolean> {
        const result = await this.db.execute(
            sql`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='departments' AND column_name='event_id') AS pending`,
        );
        return result.rows[0]?.pending === true;
    }
}
