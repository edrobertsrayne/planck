import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import {
	examSpec,
	topic,
	specPoint,
	teachingClass,
	timetableConfig,
	timetableSlot
} from './schema';

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
		expect(columnNames).toContain('exam_spec_id');
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

	it('should have name as required', () => {
		const nameColumn = config.columns.find((col) => col.name === 'name');
		expect(nameColumn?.notNull).toBe(true);
	});

	it('should have year_group as required', () => {
		const yearGroupColumn = config.columns.find((col) => col.name === 'year_group');
		expect(yearGroupColumn?.notNull).toBe(true);
	});

	it('should have exam_spec_id as required', () => {
		const examSpecIdColumn = config.columns.find((col) => col.name === 'exam_spec_id');
		expect(examSpecIdColumn?.notNull).toBe(true);
	});

	it('should have academic_year as required', () => {
		const academicYearColumn = config.columns.find((col) => col.name === 'academic_year');
		expect(academicYearColumn?.notNull).toBe(true);
	});

	it('should have optional fields (student_count, room, notes)', () => {
		const studentCountColumn = config.columns.find((col) => col.name === 'student_count');
		const roomColumn = config.columns.find((col) => col.name === 'room');
		const notesColumn = config.columns.find((col) => col.name === 'notes');

		expect(studentCountColumn?.notNull).toBe(false);
		expect(roomColumn?.notNull).toBe(false);
		expect(notesColumn?.notNull).toBe(false);
	});

	it('should have foreign key to exam_spec table', () => {
		expect(config.foreignKeys.length).toBe(1);

		// Verify the FK is on the exam_spec_id column
		const fk = config.foreignKeys[0];
		const reference = fk.reference();
		expect(reference.columns[0].name).toBe('exam_spec_id');
	});
});

describe('examSpec schema', () => {
	const config = getTableConfig(examSpec);

	it('should have table name "exam_spec"', () => {
		expect(config.name).toBe('exam_spec');
	});

	it('should have required columns', () => {
		const columnNames = config.columns.map((col) => col.name);
		expect(columnNames).toContain('id');
		expect(columnNames).toContain('board');
		expect(columnNames).toContain('level');
		expect(columnNames).toContain('name');
	});
});

describe('topic schema', () => {
	const config = getTableConfig(topic);

	it('should have table name "topic"', () => {
		expect(config.name).toBe('topic');
	});

	it('should have foreign key to exam_spec', () => {
		const examSpecIdColumn = config.columns.find((col) => col.name === 'exam_spec_id');
		expect(examSpecIdColumn?.notNull).toBe(true);
	});

	it('should support hierarchical structure with parent_id', () => {
		const columnNames = config.columns.map((col) => col.name);
		expect(columnNames).toContain('parent_id');
	});
});

describe('specPoint schema', () => {
	const config = getTableConfig(specPoint);

	it('should have table name "spec_point"', () => {
		expect(config.name).toBe('spec_point');
	});

	it('should have required reference and content columns', () => {
		const referenceColumn = config.columns.find((col) => col.name === 'reference');
		const contentColumn = config.columns.find((col) => col.name === 'content');

		expect(referenceColumn?.notNull).toBe(true);
		expect(contentColumn?.notNull).toBe(true);
	});
});

describe('timetableConfig schema', () => {
	const config = getTableConfig(timetableConfig);

	it('should have table name "timetable_config"', () => {
		expect(config.name).toBe('timetable_config');
	});

	it('should have all required columns', () => {
		const columnNames = config.columns.map((col) => col.name);
		expect(columnNames).toContain('id');
		expect(columnNames).toContain('academic_year');
		expect(columnNames).toContain('weeks');
		expect(columnNames).toContain('periods_per_day');
		expect(columnNames).toContain('days_per_week');
		expect(columnNames).toContain('created_at');
		expect(columnNames).toContain('updated_at');
	});

	it('should have id as primary key', () => {
		const idColumn = config.columns.find((col) => col.name === 'id');
		expect(idColumn?.primary).toBe(true);
	});

	it('should have academic_year as required and unique', () => {
		const academicYearColumn = config.columns.find((col) => col.name === 'academic_year');
		expect(academicYearColumn?.notNull).toBe(true);
		expect(academicYearColumn?.isUnique).toBe(true);
	});

	it('should have weeks as required with default', () => {
		const weeksColumn = config.columns.find((col) => col.name === 'weeks');
		expect(weeksColumn?.notNull).toBe(true);
		expect(weeksColumn?.default).toBe(1);
	});

	it('should have periods_per_day as required with default', () => {
		const periodsColumn = config.columns.find((col) => col.name === 'periods_per_day');
		expect(periodsColumn?.notNull).toBe(true);
		expect(periodsColumn?.default).toBe(6);
	});

	it('should have days_per_week as required with default', () => {
		const daysColumn = config.columns.find((col) => col.name === 'days_per_week');
		expect(daysColumn?.notNull).toBe(true);
		expect(daysColumn?.default).toBe(5);
	});
});

describe('timetableSlot schema', () => {
	const config = getTableConfig(timetableSlot);

	it('should have table name "timetable_slot"', () => {
		expect(config.name).toBe('timetable_slot');
	});

	it('should have all required columns', () => {
		const columnNames = config.columns.map((col) => col.name);
		expect(columnNames).toContain('id');
		expect(columnNames).toContain('class_id');
		expect(columnNames).toContain('day');
		expect(columnNames).toContain('period_start');
		expect(columnNames).toContain('period_end');
		expect(columnNames).toContain('week');
		expect(columnNames).toContain('created_at');
		expect(columnNames).toContain('updated_at');
	});

	it('should have id as primary key', () => {
		const idColumn = config.columns.find((col) => col.name === 'id');
		expect(idColumn?.primary).toBe(true);
	});

	it('should have class_id as required', () => {
		const classIdColumn = config.columns.find((col) => col.name === 'class_id');
		expect(classIdColumn?.notNull).toBe(true);
	});

	it('should have day as required', () => {
		const dayColumn = config.columns.find((col) => col.name === 'day');
		expect(dayColumn?.notNull).toBe(true);
	});

	it('should have period_start as required', () => {
		const periodStartColumn = config.columns.find((col) => col.name === 'period_start');
		expect(periodStartColumn?.notNull).toBe(true);
	});

	it('should have period_end as required (supports double periods)', () => {
		const periodEndColumn = config.columns.find((col) => col.name === 'period_end');
		expect(periodEndColumn?.notNull).toBe(true);
	});

	it('should have week as optional (null for 1-week, A/B for 2-week)', () => {
		const weekColumn = config.columns.find((col) => col.name === 'week');
		expect(weekColumn?.notNull).toBe(false);
	});

	it('should have foreign key to class table', () => {
		expect(config.foreignKeys.length).toBe(1);

		const fk = config.foreignKeys[0];
		const reference = fk.reference();
		expect(reference.columns[0].name).toBe('class_id');
	});
});
