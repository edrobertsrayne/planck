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
