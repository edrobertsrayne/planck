CREATE TYPE "public"."attachment_entity_type" AS ENUM('class', 'module', 'lesson', 'scheduledLesson', 'course');--> statement-breakpoint
CREATE TYPE "public"."attachment_type" AS ENUM('file', 'link');--> statement-breakpoint
CREATE TYPE "public"."calendar_event_type" AS ENUM('holiday', 'closure', 'absence');--> statement-breakpoint
CREATE TYPE "public"."timetable_week" AS ENUM('A', 'B');--> statement-breakpoint
CREATE TABLE "attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "attachment_type" NOT NULL,
	"entity_type" "attachment_entity_type" NOT NULL,
	"entity_id" text NOT NULL,
	"file_path" text,
	"url" text,
	"file_name" text,
	"mime_type" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_event" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "calendar_event_type" NOT NULL,
	"title" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"affects_all_classes" boolean DEFAULT true NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson" (
	"id" text PRIMARY KEY NOT NULL,
	"module_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"duration" integer DEFAULT 1 NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"course_id" text NOT NULL,
	"notes" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"class_id" text NOT NULL,
	"module_id" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_lesson" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"lesson_id" text NOT NULL,
	"calendar_date" timestamp NOT NULL,
	"timetable_slot_id" text,
	"title" text NOT NULL,
	"content" text,
	"duration" integer DEFAULT 1 NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"year_group" integer NOT NULL,
	"course_id" text,
	"academic_year" text NOT NULL,
	"student_count" integer,
	"room" text,
	"notes" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable_config" (
	"id" text PRIMARY KEY NOT NULL,
	"academic_year" text NOT NULL,
	"weeks" integer DEFAULT 1 NOT NULL,
	"periods_per_day" integer DEFAULT 6 NOT NULL,
	"days_per_week" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "timetable_config_academic_year_unique" UNIQUE("academic_year")
);
--> statement-breakpoint
CREATE TABLE "timetable_slot" (
	"id" text PRIMARY KEY NOT NULL,
	"class_id" text NOT NULL,
	"day" integer NOT NULL,
	"period_start" integer NOT NULL,
	"period_end" integer NOT NULL,
	"week" timetable_week,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_module_id_module_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."module"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module" ADD CONSTRAINT "module_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_assignment" ADD CONSTRAINT "module_assignment_class_id_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_assignment" ADD CONSTRAINT "module_assignment_module_id_module_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."module"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_lesson" ADD CONSTRAINT "scheduled_lesson_assignment_id_module_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."module_assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_lesson" ADD CONSTRAINT "scheduled_lesson_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_lesson" ADD CONSTRAINT "scheduled_lesson_timetable_slot_id_timetable_slot_id_fk" FOREIGN KEY ("timetable_slot_id") REFERENCES "public"."timetable_slot"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class" ADD CONSTRAINT "class_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_slot" ADD CONSTRAINT "timetable_slot_class_id_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class"("id") ON DELETE cascade ON UPDATE no action;