import 'dotenv/config';
import { cp, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/cockroach';
import { migrate } from 'drizzle-orm/cockroach/migrator';
import { Client } from 'pg';

// Stop at the first pending post-deployment migration. Never run later migrations
// ahead of that barrier; already-applied contracts do not block future releases.
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL が必要です');
const client = new Client({ connectionString: process.env.DATABASE_URL });
const temporary = await mkdtemp(join(tmpdir(), 'backend-expand-'));
try {
    await client.connect();
    let applied = new Set<string>();
    try {
        const result = await client.query<{ name: string }>(
            'SELECT name FROM drizzle.__drizzle_migrations',
        );
        applied = new Set(result.rows.map((row) => row.name));
    } catch (error) {
        const code = (error as { code?: string }).code;
        // Fresh databases and the old journal format are upgraded by Drizzle.
        if (code !== '42P01' && code !== '42703') throw error;
    }
    const source = resolve('drizzle');
    const entries = (await readdir(source, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory() && /^\d{14}_/.test(entry.name))
        .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
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
        if (phase === 'contract' && !applied.has(entry.name)) break;
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
