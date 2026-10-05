ALTER TABLE "rooms" DROP CONSTRAINT IF EXISTS "rooms_pre_day_manager_id_departments_id_fkey";--> statement-breakpoint
ALTER TABLE "rooms" DROP CONSTRAINT IF EXISTS "rooms_day_manager_id_departments_id_fkey";--> statement-breakpoint
ALTER TABLE "rooms" DROP CONSTRAINT "rooms_event_id_pre_day_manager_id_departments_event_id_id_fkey";--> statement-breakpoint
ALTER TABLE "rooms" DROP CONSTRAINT "rooms_event_id_day_manager_id_departments_event_id_id_fkey";--> statement-breakpoint
ALTER TABLE "timetable_item_departments" DROP CONSTRAINT "timetable_item_departments_eqgsdtU8sHK8_fkey";--> statement-breakpoint
ALTER TABLE "departments" DROP CONSTRAINT "departments_event_id_access_codes_id_fkey";--> statement-breakpoint
DROP INDEX "departments_event_id_id_idx" CASCADE;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "department_id" uuid;--> statement-breakpoint
-- 同名部署の代表IDを固定し、全会期の参照を保持して統合する。
CREATE TABLE IF NOT EXISTS "department_merge_map" (old_id uuid PRIMARY KEY, canonical_id uuid NOT NULL);--> statement-breakpoint
INSERT INTO "department_merge_map" (old_id, canonical_id)
SELECT id, first_value(id) OVER (PARTITION BY name ORDER BY id) FROM "departments"
ON CONFLICT (old_id) DO NOTHING;--> statement-breakpoint
UPDATE "rooms" SET pre_day_manager_id = m.canonical_id FROM "department_merge_map" m WHERE "rooms".pre_day_manager_id = m.old_id AND m.old_id <> m.canonical_id;--> statement-breakpoint
UPDATE "rooms" SET day_manager_id = m.canonical_id FROM "department_merge_map" m WHERE "rooms".day_manager_id = m.old_id AND m.old_id <> m.canonical_id;--> statement-breakpoint
INSERT INTO "timetable_item_departments" (event_id, timetable_item_id, department_id)
SELECT DISTINCT t.event_id, t.timetable_item_id, m.canonical_id FROM "timetable_item_departments" t JOIN "department_merge_map" m ON t.department_id = m.old_id WHERE m.old_id <> m.canonical_id
ON CONFLICT (timetable_item_id, department_id) DO NOTHING;--> statement-breakpoint
DELETE FROM "timetable_item_departments" WHERE department_id IN (SELECT old_id FROM "department_merge_map" WHERE old_id <> canonical_id);--> statement-breakpoint
DELETE FROM "departments" WHERE id IN (SELECT old_id FROM "department_merge_map" WHERE old_id <> canonical_id);--> statement-breakpoint
DROP TABLE "department_merge_map";--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_pre_day_manager_id_departments_id_fkey" FOREIGN KEY ("pre_day_manager_id") REFERENCES "departments"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_day_manager_id_departments_id_fkey" FOREIGN KEY ("day_manager_id") REFERENCES "departments"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "timetable_item_departments" ADD CONSTRAINT "timetable_item_departments_department_id_departments_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "departments_name_idx" ON "departments" ("name");--> statement-breakpoint
ALTER TABLE "departments" DROP COLUMN "event_id";