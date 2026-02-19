import { db } from '$lib/server/db';
import { teachingClass, examSpec } from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getCurrentAcademicYear } from '$lib/server/utils/academicYear';

export const load: PageServerLoad = async () => {
	// Get all classes with their exam specifications
	const classes = await db
		.select({
			id: teachingClass.id,
			name: teachingClass.name,
			yearGroup: teachingClass.yearGroup,
			academicYear: teachingClass.academicYear,
			studentCount: teachingClass.studentCount,
			room: teachingClass.room,
			notes: teachingClass.notes,
			createdAt: teachingClass.createdAt,
			updatedAt: teachingClass.updatedAt,
			examSpec: {
				id: examSpec.id,
				board: examSpec.board,
				level: examSpec.level,
				name: examSpec.name,
				specCode: examSpec.specCode,
				specYear: examSpec.specYear
			}
		})
		.from(teachingClass)
		.leftJoin(examSpec, eq(teachingClass.examSpecId, examSpec.id))
		.orderBy(asc(teachingClass.name));

	// Get all available exam specifications for the create form
	const examSpecs = await db
		.select()
		.from(examSpec)
		.orderBy(asc(examSpec.level), asc(examSpec.board));

	return {
		classes,
		examSpecs,
		currentAcademicYear: getCurrentAcademicYear()
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name')?.toString() || '';
		const yearGroup = parseInt(data.get('yearGroup')?.toString() || '0');
		const examSpecId = data.get('examSpecId')?.toString() || '';
		const academicYear = data.get('academicYear')?.toString() || '';
		const studentCountStr = data.get('studentCount')?.toString();
		const room = data.get('room')?.toString();
		const notes = data.get('notes')?.toString();

		// Validation
		if (!name.trim()) {
			return { error: 'Class name is required' };
		}

		if (yearGroup < 7 || yearGroup > 13) {
			return { error: 'Year group must be between 7 and 13' };
		}

		if (!examSpecId.trim()) {
			return { error: 'Exam specification is required' };
		}

		if (!academicYear.trim()) {
			return { error: 'Academic year is required' };
		}

		// Handle optional student count
		let studentCount: number | null = null;
		if (studentCountStr && studentCountStr.trim()) {
			studentCount = parseInt(studentCountStr);
			if (isNaN(studentCount) || studentCount <= 0) {
				return { error: 'Student count must be a positive number' };
			}
		}

		// Insert new class
		await db.insert(teachingClass).values({
			name: name.trim(),
			yearGroup,
			examSpecId,
			academicYear: academicYear.trim(),
			studentCount,
			room: room && room.trim() ? room.trim() : null,
			notes: notes && notes.trim() ? notes.trim() : null
		});

		return { success: true };
	}
};
