-- 旧版の列・部署IDを保持する事前拡張。
ALTER TABLE "rooms" DROP CONSTRAINT IF EXISTS "rooms_pre_day_manager_id_departments_id_fkey";--> statement-breakpoint
ALTER TABLE "rooms" DROP CONSTRAINT IF EXISTS "rooms_day_manager_id_departments_id_fkey";--> statement-breakpoint
ALTER TABLE "rooms" DROP CONSTRAINT IF EXISTS "rooms_event_id_pre_day_manager_id_departments_event_id_id_fkey";--> statement-breakpoint
ALTER TABLE "rooms" DROP CONSTRAINT IF EXISTS "rooms_event_id_day_manager_id_departments_event_id_id_fkey";--> statement-breakpoint
ALTER TABLE "timetable_item_departments" DROP CONSTRAINT IF EXISTS "timetable_item_departments_eqgsdtU8sHK8_fkey";--> statement-breakpoint
ALTER TABLE "departments" ALTER COLUMN "event_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department_id" uuid;--> statement-breakpoint
ALTER TABLE "rooms" DROP CONSTRAINT IF EXISTS "rooms_pre_day_manager_id_departments_id_fkey";--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_pre_day_manager_id_departments_id_fkey" FOREIGN KEY ("pre_day_manager_id") REFERENCES "departments"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "rooms" DROP CONSTRAINT IF EXISTS "rooms_day_manager_id_departments_id_fkey";--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_day_manager_id_departments_id_fkey" FOREIGN KEY ("day_manager_id") REFERENCES "departments"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "timetable_item_departments" DROP CONSTRAINT IF EXISTS "timetable_item_departments_department_id_departments_id_fkey";--> statement-breakpoint
ALTER TABLE "timetable_item_departments" ADD CONSTRAINT "timetable_item_departments_department_id_departments_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_department_id_departments_id_fkey";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT;

--> statement-breakpoint
-- 復元後の旧セッション拒否に必要。後続migrationでも冪等に記録する。
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "session_version" int4 DEFAULT 0 NOT NULL;
