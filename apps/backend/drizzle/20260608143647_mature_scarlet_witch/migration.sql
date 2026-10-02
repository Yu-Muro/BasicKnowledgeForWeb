CREATE TABLE "timetable_item_departments" (
	"event_id" uuid NOT NULL,
	"timetable_item_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	CONSTRAINT "timetable_item_departments_pkey" PRIMARY KEY("timetable_item_id","department_id")
);
--> statement-breakpoint
ALTER TABLE "timetable_items" ADD COLUMN "is_public" bool DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "timetable_items_event_id_id_idx" ON "timetable_items" ("event_id","id");--> statement-breakpoint
ALTER TABLE "timetable_item_departments" ADD CONSTRAINT "timetable_item_departments_event_id_access_codes_id_fkey" FOREIGN KEY ("event_id") REFERENCES "access_codes"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "timetable_item_departments" ADD CONSTRAINT "timetable_item_departments_Nqfst4FRlcDo_fkey" FOREIGN KEY ("event_id","timetable_item_id") REFERENCES "timetable_items"("event_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "timetable_item_departments" ADD CONSTRAINT "timetable_item_departments_eqgsdtU8sHK8_fkey" FOREIGN KEY ("event_id","department_id") REFERENCES "departments"("event_id","id") ON DELETE RESTRICT;
