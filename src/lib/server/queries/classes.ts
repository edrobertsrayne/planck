import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { klass, course } from '$lib/server/db/schema';

export function listClasses(userId: string) {
	return db
		.select({
			id: klass.id,
			name: klass.name,
			courseId: klass.courseId,
			courseName: course.name,
			colour: course.colour
		})
		.from(klass)
		.innerJoin(course, eq(klass.courseId, course.id))
		.where(eq(klass.userId, userId))
		.orderBy(klass.name);
}

export function createClass(userId: string, name: string, courseId: number) {
	return db.insert(klass).values({ userId, name, courseId });
}

export function updateClass(userId: string, id: number, name: string, courseId: number) {
	return db
		.update(klass)
		.set({ name, courseId })
		.where(and(eq(klass.userId, userId), eq(klass.id, id)));
}

export function deleteClass(userId: string, id: number) {
	return db.delete(klass).where(and(eq(klass.userId, userId), eq(klass.id, id)));
}

export async function getClass(userId: string, id: number) {
	const [row] = await db
		.select()
		.from(klass)
		.where(and(eq(klass.userId, userId), eq(klass.id, id)));
	return row ?? null;
}
