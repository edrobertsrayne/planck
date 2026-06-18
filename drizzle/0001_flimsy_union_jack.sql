ALTER TABLE "scheduled_lesson" DROP CONSTRAINT "scheduled_lesson_lesson_id_lesson_id_fk";
--> statement-breakpoint
ALTER TABLE "scheduled_lesson" DROP CONSTRAINT "scheduled_lesson_module_id_module_id_fk";
--> statement-breakpoint
ALTER TABLE "scheduled_lesson" ADD CONSTRAINT "scheduled_lesson_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_lesson" ADD CONSTRAINT "scheduled_lesson_module_id_module_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."module"("id") ON DELETE set null ON UPDATE no action;