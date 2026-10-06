import 'dotenv/config';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { drizzle } from 'drizzle-orm/cockroach';
import { migrate } from 'drizzle-orm/cockroach/migrator';
import { Client } from 'pg';

const exec = promisify(execFile);
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL が必要です');
const base = process.env.DATABASE_URL;
const source = resolve('drizzle');
const oldMigrations = await mkdtemp(
    join(tmpdir(), 'department-migration-test-'),
);
for (const entry of await readdir(source, { withFileTypes: true })) {
    if (
        entry.isDirectory() &&
        /^\d{14}_/.test(entry.name) &&
        entry.name < '20261005225511'
    ) {
        await cp(join(source, entry.name), join(oldMigrations, entry.name), {
            recursive: true,
        });
    }
}

const root = new Client({ connectionString: base });
await root.connect();
const dbName = `verify_departments_${Date.now()}`;
await root.query(`CREATE DATABASE ${dbName}`);
const temporaryUrl = new URL(base);
temporaryUrl.pathname = `/${dbName}`;
const client = new Client({ connectionString: temporaryUrl.toString() });
await client.connect();
try {
    const db = drizzle({ client });
    await migrate(db, { migrationsFolder: oldMigrations });
    const e1 = '00000000-0000-4000-8000-000000000001',
        e2 = '00000000-0000-4000-8000-000000000002';
    const d1 = '10000000-0000-4000-8000-000000000001',
        d2 = '10000000-0000-4000-8000-000000000002',
        d3 = '10000000-0000-4000-8000-000000000003';
    const t1 = '20000000-0000-4000-8000-000000000001';
    await client.query(
        `INSERT INTO access_codes(id,code,event_name,valid_from,valid_to,created_by) VALUES ($1,'a','会期1',now(),now(),$1),($2,'b','会期2',now(),now(),$1)`,
        [e1, e2],
    );
    await client.query(
        `INSERT INTO departments(id,event_id,name) VALUES ($1,$4,'企画部'),($2,$5,'企画部'),($3,$5,'企画部')`,
        [d1, d2, d3, e1, e2],
    );
    await client.query(
        `INSERT INTO users(name,email,password) VALUES ('既存ユーザー','legacy@test.com','hash')`,
    );
    await client.query(
        `INSERT INTO rooms(event_id,building_name,floor,room_name,day_manager_id,day_purpose,pre_day_manager_id) VALUES ($1,'A','1','部屋',$2,'受付',$3)`,
        [e2, d2, d3],
    );
    await client.query(
        `INSERT INTO timetable_items(id,event_id,title,start_time,end_time,location) VALUES ($1,$2,'予定',now(),now(),'会場')`,
        [t1, e2],
    );
    await client.query(
        `INSERT INTO timetable_item_departments(event_id,timetable_item_id,department_id) VALUES ($1,$2,$3),($1,$2,$4)`,
        [e2, t1, d2, d3],
    );
    await exec(process.execPath, ['scripts/migrate-expand.ts'], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: temporaryUrl.toString() },
    });
    // Deployment failure leaves the old event-scoped queries and references usable.
    assert.equal(
        (
            await client.query('SELECT * FROM departments WHERE event_id=$1', [
                e2,
            ])
        ).rows.length,
        2,
    );
    assert.equal(
        (
            await client.query(
                'SELECT d.name FROM rooms r JOIN departments d ON d.id=r.day_manager_id AND d.event_id=r.event_id',
            )
        ).rows.length,
        1,
    );
    await client.query(
        "INSERT INTO departments(event_id,name) VALUES ($1,'旧版の作成')",
        [e1],
    );
    // The new backend works before contraction, including global creation and assignment.
    await client.query("INSERT INTO departments(name) VALUES ('新版の作成')");
    await client.query(
        "INSERT INTO users(name,email,password) VALUES ('未所属ユーザー','unassigned@test.com','hash')",
    );
    await client.query(
        "UPDATE users SET department_id=$1 WHERE email='legacy@test.com'",
        [d3],
    );
    await exec(process.execPath, ['scripts/migrate-expand.ts'], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: temporaryUrl.toString() },
    });
    assert.equal(
        (
            await client.query('SELECT * FROM departments WHERE event_id=$1', [
                e2,
            ])
        ).rows.length,
        2,
    );
    await migrate(db, { migrationsFolder: source });
    assert.equal(
        (await client.query("SELECT * FROM departments WHERE name='企画部'"))
            .rows.length,
        1,
    );
    assert.deepEqual(
        (
            await client.query(
                'SELECT day_manager_id,pre_day_manager_id FROM rooms',
            )
        ).rows,
        [{ day_manager_id: d1, pre_day_manager_id: d1 }],
    );
    assert.deepEqual(
        (
            await client.query(
                'SELECT department_id FROM timetable_item_departments',
            )
        ).rows,
        [{ department_id: d1 }],
    );
    assert.equal(
        (
            await client.query(
                "SELECT department_id FROM users WHERE email='legacy@test.com'",
            )
        ).rows[0].department_id,
        d1,
    );
    assert.equal(
        (
            await client.query(
                "SELECT department_id FROM users WHERE email='unassigned@test.com'",
            )
        ).rows[0].department_id,
        null,
    );
    await assert.rejects(
        client.query('DELETE FROM departments WHERE id=$1', [d1]),
        /foreign key/,
    );
    await assert.rejects(
        client.query("INSERT INTO departments(name) VALUES ('企画部')"),
        /duplicate/,
    );
    await migrate(db, { migrationsFolder: source });
    await exec(process.execPath, ['scripts/migrate-expand.ts'], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: temporaryUrl.toString() },
    });
    console.log(
        'PASS: 互換拡張、旧版・新版の読み書き、段階適用、 既存データ移行、重複タグ統合、部屋参照保持、ユーザー所属、再適用',
    );
} finally {
    await client.end();
    await root.query(`DROP DATABASE ${dbName} CASCADE`);
    await root.end();
    await rm(oldMigrations, { recursive: true, force: true });
}
