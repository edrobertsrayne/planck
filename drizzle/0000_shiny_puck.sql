CREATE TABLE `attachment` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`file_path` text,
	`url` text,
	`file_name` text,
	`mime_type` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `calendar_event` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`affects_all_classes` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exam_spec` (
	`id` text PRIMARY KEY NOT NULL,
	`board` text NOT NULL,
	`level` text NOT NULL,
	`name` text NOT NULL,
	`spec_code` text,
	`spec_year` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lesson` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`duration` integer DEFAULT 1 NOT NULL,
	`order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `module`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `lesson_spec_point` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_id` text NOT NULL,
	`spec_point_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`spec_point_id`) REFERENCES `spec_point`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `module` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`target_spec_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`target_spec_id`) REFERENCES `exam_spec`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `module_assignment` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`module_id` text NOT NULL,
	`start_date` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `class`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`module_id`) REFERENCES `module`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `scheduled_lesson` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`calendar_date` integer NOT NULL,
	`timetable_slot_id` text,
	`title` text NOT NULL,
	`content` text,
	`duration` integer DEFAULT 1 NOT NULL,
	`order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `module_assignment`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`timetable_slot_id`) REFERENCES `timetable_slot`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `scheduled_lesson_spec_point` (
	`id` text PRIMARY KEY NOT NULL,
	`scheduled_lesson_id` text NOT NULL,
	`spec_point_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`scheduled_lesson_id`) REFERENCES `scheduled_lesson`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`spec_point_id`) REFERENCES `spec_point`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `spec_point` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`reference` text NOT NULL,
	`content` text NOT NULL,
	`notes` text,
	`tier` text DEFAULT 'both',
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topic`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `class` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`year_group` integer NOT NULL,
	`exam_spec_id` text NOT NULL,
	`academic_year` text NOT NULL,
	`student_count` integer,
	`room` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`exam_spec_id`) REFERENCES `exam_spec`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `timetable_config` (
	`id` text PRIMARY KEY NOT NULL,
	`academic_year` text NOT NULL,
	`weeks` integer DEFAULT 1 NOT NULL,
	`periods_per_day` integer DEFAULT 6 NOT NULL,
	`days_per_week` integer DEFAULT 5 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `timetable_config_academic_year_unique` ON `timetable_config` (`academic_year`);--> statement-breakpoint
CREATE TABLE `timetable_slot` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`day` integer NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`week` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `class`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `topic` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_spec_id` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`code` text,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`exam_spec_id`) REFERENCES `exam_spec`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `topic`(`id`) ON UPDATE no action ON DELETE cascade
);
