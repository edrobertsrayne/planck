CREATE TABLE "closure_day" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	CONSTRAINT "closure_day_user_id_date_unique" UNIQUE("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "course" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"colour" text DEFAULT '#3884ff' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"course_id" integer NOT NULL,
	"colour" text DEFAULT '#8775c6' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"module_id" integer NOT NULL,
	"title" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"plan" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"course_id" integer NOT NULL,
	"name" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"description" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_file" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"lesson_id" integer,
	"scheduled_lesson_id" integer,
	"course_id" integer,
	"module_id" integer,
	"blob_url" text NOT NULL,
	"pathname" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"lesson_id" integer,
	"scheduled_lesson_id" integer,
	"course_id" integer,
	"module_id" integer,
	"url" text NOT NULL,
	"label" text,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_lesson" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"class_id" integer NOT NULL,
	"lesson_id" integer,
	"module_id" integer,
	"order_index" integer DEFAULT 0 NOT NULL,
	"date" date,
	"period" integer,
	"title" text NOT NULL,
	"room" text DEFAULT '' NOT NULL,
	"plan" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"postponed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "scheduled_lesson_user_id_class_id_date_period_unique" UNIQUE("user_id","class_id","date","period")
);
--> statement-breakpoint
CREATE TABLE "teaching_block" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"cycle_weeks" integer DEFAULT 2 NOT NULL,
	"teaching_days" integer[] DEFAULT '{1,2,3,4,5}' NOT NULL,
	"periods_per_day" integer DEFAULT 5 NOT NULL,
	"anchor_letter" text DEFAULT 'A' NOT NULL,
	CONSTRAINT "timetable_config_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "timetable_slot" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"week_letter" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"period" integer NOT NULL,
	"class_id" integer NOT NULL,
	"room" text DEFAULT '' NOT NULL,
	CONSTRAINT "timetable_slot_user_id_week_letter_day_of_week_period_unique" UNIQUE("user_id","week_letter","day_of_week","period")
);
--> statement-breakpoint
ALTER TABLE "class" ADD CONSTRAINT "class_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_module_id_module_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."module"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module" ADD CONSTRAINT "module_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_file" ADD CONSTRAINT "resource_file_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_file" ADD CONSTRAINT "resource_file_scheduled_lesson_id_scheduled_lesson_id_fk" FOREIGN KEY ("scheduled_lesson_id") REFERENCES "public"."scheduled_lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_file" ADD CONSTRAINT "resource_file_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_file" ADD CONSTRAINT "resource_file_module_id_module_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."module"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_link" ADD CONSTRAINT "resource_link_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_link" ADD CONSTRAINT "resource_link_scheduled_lesson_id_scheduled_lesson_id_fk" FOREIGN KEY ("scheduled_lesson_id") REFERENCES "public"."scheduled_lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_link" ADD CONSTRAINT "resource_link_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_link" ADD CONSTRAINT "resource_link_module_id_module_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."module"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_lesson" ADD CONSTRAINT "scheduled_lesson_class_id_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_lesson" ADD CONSTRAINT "scheduled_lesson_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_lesson" ADD CONSTRAINT "scheduled_lesson_module_id_module_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."module"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_slot" ADD CONSTRAINT "timetable_slot_class_id_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class"("id") ON DELETE cascade ON UPDATE no action;