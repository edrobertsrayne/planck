import { db } from '$lib/server/db';
import { teachingClass, course } from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getCurrentAcademicYear } from '$lib/server/utils/academicYear';

export const load: PageServerLoad = async () => {
	// Get all classes with their courses
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
			course: {
				id: course.id,
				name: course.name
			}
		})
		.from(teachingClass)
		.leftJoin(course, eq(teachingClass.courseId, course.id))
		.orderBy(asc(teachingClass.name));

	// Get all available courses for the create form
	const courses = await db.select().from(course).orderBy(asc(course.name));

	return {
		classes,
		courses,
		currentAcademicYear: getCurrentAcademicYear()
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name')?.toString() || '';
		const yearGroup = parseInt(data.get('yearGroup')?.toString() || '0');
		const courseId = data.get('courseId')?.toString();
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
			courseId: courseId && courseId.trim() ? courseId.trim() : null,
			academicYear: academicYear.trim(),
			studentCount,
			room: room && room.trim() ? room.trim() : null,
			notes: notes && notes.trim() ? notes.trim() : null
		});

		return { success: true };
	}
};
