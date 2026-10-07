-- 新版バックエンド・フロントエンドの公開成功後にのみ実行する。
ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "departments_event_id_access_codes_id_fkey";--> statement-breakpoint
DROP INDEX IF EXISTS "departments_event_id_id_idx" CASCADE;--> statement-breakpoint
-- 同名部署の代表IDを固定し、全会期の参照を保持して統合する。
CREATE TABLE IF NOT EXISTS "department_merge_map" (old_id uuid PRIMARY KEY, canonical_id uuid NOT NULL);--> statement-breakpoint
DELETE FROM "department_merge_map";--> statement-breakpoint
INSERT INTO "department_merge_map" (old_id, canonical_id)
SELECT id, first_value(id) OVER (PARTITION BY name ORDER BY id) FROM "departments"
ON CONFLICT (old_id) DO NOTHING;--> statement-breakpoint
UPDATE "rooms" SET pre_day_manager_id = m.canonical_id FROM "department_merge_map" m WHERE "rooms".pre_day_manager_id = m.old_id AND m.old_id <> m.canonical_id;--> statement-breakpoint
UPDATE "rooms" SET day_manager_id = m.canonical_id FROM "department_merge_map" m WHERE "rooms".day_manager_id = m.old_id AND m.old_id <> m.canonical_id;--> statement-breakpoint
INSERT INTO "timetable_item_departments" (event_id, timetable_item_id, department_id)
SELECT DISTINCT t.event_id, t.timetable_item_id, m.canonical_id FROM "timetable_item_departments" t JOIN "department_merge_map" m ON t.department_id = m.old_id WHERE m.old_id <> m.canonical_id
ON CONFLICT (timetable_item_id, department_id) DO NOTHING;--> statement-breakpoint
DELETE FROM "timetable_item_departments" WHERE department_id IN (SELECT old_id FROM "department_merge_map" WHERE old_id <> canonical_id);--> statement-breakpoint
UPDATE "users" SET department_id = m.canonical_id FROM "department_merge_map" m WHERE "users".department_id = m.old_id AND m.old_id <> m.canonical_id;--> statement-breakpoint
DELETE FROM "departments" WHERE id IN (SELECT old_id FROM "department_merge_map" WHERE old_id <> canonical_id);--> statement-breakpoint
DROP TABLE IF EXISTS "department_merge_map";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "departments_name_idx" ON "departments" ("name");--> statement-breakpoint
ALTER TABLE "departments" DROP COLUMN IF EXISTS "event_id";
