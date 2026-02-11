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
CREATE TABLE `task` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`priority` integer DEFAULT 1 NOT NULL
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
