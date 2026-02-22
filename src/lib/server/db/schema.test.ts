import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import {
	course,
	teachingClass,
	timetableConfig,
	timetableSlot,
	module,
	lesson,
	moduleAssignment,
	scheduledLesson,
	calendarEvent,
	attachment
} from './schema';

describe('course schema', () => {
	const config = getTableConfig(course);

	it('should have table name "course"', () => {
		expect(config.name).toBe('course');
	});

	it('should have all required columns', () => {
		const columnNames = config.columns.map((col) => col.name);
		expect(columnNames).toContain('id');
		expect(columnNames).toContain('name');
		expect(columnNames).toContain('notes');
		expect(columnNames).toContain('created_at');
		expect(columnNames).toContain('updated_at');
	});

	it('should have id as primary key', () => {
		const idColumn = config.columns.find((col) => col.name === 'id');
		expect(idColumn?.primary).toBe(true);
	});

	it('should have name as required', () => {
		const nameColumn = config.columns.find((col) => col.name === 'name');
		expect(nameColumn?.notNull).toBe(true);
	});

	it('should have notes as optional', () => {
		const notesColumn = config.columns.find((col) => col.name === 'notes');
		expect(notesColumn?.notNull).toBe(false);
	});
});

describe('teachingClass schema', () => {
	const config = getTableConfig(teachingClass);

	it('should have table name "class"', () => {
		expect(config.name).toBe('class');
	});

	it('should have all required columns', () => {
		const columnNames = config.columns.map((col) => col.name);
		expect(columnNames).toContain('id');
		expect(columnNames).toContain('name');
		expect(columnNames).toContain('year_group');
		expect(columnNames).toContain('course_id');
		expect(columnNames).toContain('academic_year');
		expect(columnNames).toContain('student_count');
		expect(columnNames).toContain('room');
		expect(columnNames).toContain('notes');
		expect(columnNames).toContain('created_at');
		expect(columnNames).toContain('updated_at');
	});

	it('should have id as primary key', () => {
		const idColumn = config.columns.find((col) => col.name === 'id');
		expect(idColumn?.primary).toBe(true);
	});

	it('should have course_id as optional', () => {
		const courseIdColumn = config.columns.find((col) => col.name === 'course_id');
		expect(courseIdColumn?.notNull).toBe(false);
	});

	it('should have foreign key to course table', () => {
		expect(config.foreignKeys.length).toBe(1);
		const fk = config.foreignKeys[0];
		const reference = fk.reference();
		expect(reference.columns[0].name).toBe('course_id');
	});
});

describe('timetableConfig schema', () => {
	const config = getTableConfig(timetableConfig);

	it('should have table name "timetable_config"', () => {
		expect(config.name).toBe('timetable_config');
	});

	it('should have academic_year as required and unique', () => {
		const academicYearColumn = config.columns.find((col) => col.name === 'academic_year');
		expect(academicYearColumn?.notNull).toBe(true);
		expect(academicYearColumn?.isUnique).toBe(true);
	});
});

describe('timetableSlot schema', () => {
	const config = getTableConfig(timetableSlot);

	it('should have table name "timetable_slot"', () => {
		expect(config.name).toBe('timetable_slot');
	});

	it('should have foreign key to class table', () => {
		expect(config.foreignKeys.length).toBe(1);
		const fk = config.foreignKeys[0];
		const reference = fk.reference();
		expect(reference.columns[0].name).toBe('class_id');
	});
});

describe('module schema', () => {
	const config = getTableConfig(module);

	it('should have table name "module"', () => {
		expect(config.name).toBe('module');
	});

	it('should have all required columns', () => {
		const columnNames = config.columns.map((col) => col.name);
		expect(columnNames).toContain('id');
		expect(columnNames).toContain('name');
		expect(columnNames).toContain('course_id');
		expect(columnNames).toContain('notes');
		expect(columnNames).toContain('created_at');
		expect(columnNames).toContain('updated_at');
	});

	it('should have course_id as required', () => {
		const courseIdColumn = config.columns.find((col) => col.name === 'course_id');
		expect(courseIdColumn?.notNull).toBe(true);
	});

	it('should have foreign key to course table', () => {
		expect(config.foreignKeys.length).toBe(1);
		const fk = config.foreignKeys[0];
		const reference = fk.reference();
		expect(reference.columns[0].name).toBe('course_id');
	});
});

describe('lesson schema', () => {
	const config = getTableConfig(lesson);

	it('should have table name "lesson"', () => {
		expect(config.name).toBe('lesson');
	});

	it('should have duration with default of 1', () => {
		const durationColumn = config.columns.find((col) => col.name === 'duration');
		expect(durationColumn?.notNull).toBe(true);
		expect(durationColumn?.default).toBe(1);
	});

	it('should have foreign key to module table', () => {
		expect(config.foreignKeys.length).toBe(1);
		const fk = config.foreignKeys[0];
		const reference = fk.reference();
		expect(reference.columns[0].name).toBe('module_id');
	});
});

describe('moduleAssignment schema', () => {
	const config = getTableConfig(moduleAssignment);

	it('should have table name "module_assignment"', () => {
		expect(config.name).toBe('module_assignment');
	});

	it('should have foreign keys to class and module tables', () => {
		expect(config.foreignKeys.length).toBe(2);
		const fkColumns = config.foreignKeys.map((fk) => fk.reference().columns[0].name);
		expect(fkColumns).toContain('class_id');
		expect(fkColumns).toContain('module_id');
	});
});

describe('scheduledLesson schema', () => {
	const config = getTableConfig(scheduledLesson);

	it('should have table name "scheduled_lesson"', () => {
		expect(config.name).toBe('scheduled_lesson');
	});

	it('should have foreign keys to assignment, lesson, and timetable_slot tables', () => {
		expect(config.foreignKeys.length).toBe(3);
		const fkColumns = config.foreignKeys.map((fk) => fk.reference().columns[0].name);
		expect(fkColumns).toContain('assignment_id');
		expect(fkColumns).toContain('lesson_id');
		expect(fkColumns).toContain('timetable_slot_id');
	});
});

describe('calendarEvent schema', () => {
	const config = getTableConfig(calendarEvent);

	it('should have table name "calendar_event"', () => {
		expect(config.name).toBe('calendar_event');
	});

	it('should have no foreign keys', () => {
		expect(config.foreignKeys.length).toBe(0);
	});
});

describe('attachment schema', () => {
	const config = getTableConfig(attachment);

	it('should have table name "attachment"', () => {
		expect(config.name).toBe('attachment');
	});

	it('should have no foreign keys (polymorphic association)', () => {
		expect(config.foreignKeys.length).toBe(0);
	});
});
