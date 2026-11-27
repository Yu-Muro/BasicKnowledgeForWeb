import 'dotenv/config';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/cockroach';
import { migrate } from 'drizzle-orm/cockroach/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { Client } from 'pg';

// Stop at the first pending post-deployment migration. Never run later migrations
// ahead of that barrier; already-applied contracts do not block future releases.
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL が必要です');
const client = new Client({ connectionString: process.env.DATABASE_URL });
const temporary = await mkdtemp(join(tmpdir(), 'backend-expand-'));
try {
    await client.connect();
    let applied = new Set<number>();
    try {
        const result = await client.query<{ created_at: string }>(
            'SELECT created_at FROM drizzle.__drizzle_migrations',
        );
        applied = new Set(result.rows.map((row) => Number(row.created_at)));
    } catch (error) {
        const code = (error as { code?: string }).code;
        // Both old and current journal formats record created_at.
        if (code !== '42P01') throw error;
    }
    const source = resolve('drizzle');
    for (const entry of readMigrationFiles({ migrationsFolder: source })) {
        let phase: string | undefined;
        try {
            phase = JSON.parse(
                await readFile(
                    join(source, entry.name, 'deployment-phase.json'),
                    'utf8',
                ),
            ).phase;
        } catch (error) {
            if ((error as { code?: string }).code !== 'ENOENT') throw error;
        }
        if (phase === 'contract' && !applied.has(entry.folderMillis)) break;
        await cp(join(source, entry.name), join(temporary, entry.name), {
            recursive: true,
        });
    }
    await migrate(drizzle({ client }), { migrationsFolder: temporary });
    console.log('公開前の互換マイグレーションを適用しました');
} finally {
    await client.end();
    await rm(temporary, { recursive: true, force: true });
}
