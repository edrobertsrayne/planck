import { eq, and, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { course, module, lesson } from '$lib/server/db/schema';

export function listCourses(userId: string) {
	return db.select().from(course).where(eq(course.userId, userId)).orderBy(course.name);
}

export function createCourse(userId: string, name: string, colour: string) {
	return db.insert(course).values({ userId, name, colour });
}

export function updateCourse(userId: string, id: number, name: string, colour: string) {
	return db
		.update(course)
		.set({ name, colour })
		.where(and(eq(course.userId, userId), eq(course.id, id)));
}

export function deleteCourse(userId: string, id: number) {
	return db.delete(course).where(and(eq(course.userId, userId), eq(course.id, id)));
}

export async function getCourse(userId: string, id: number) {
	const [row] = await db
		.select()
		.from(course)
		.where(and(eq(course.userId, userId), eq(course.id, id)));
	return row ?? null;
}

export function listModules(userId: string, courseId: number) {
	return db
		.select()
		.from(module)
		.where(and(eq(module.userId, userId), eq(module.courseId, courseId)))
		.orderBy(module.orderIndex);
}

export async function createModule(userId: string, courseId: number, name: string) {
	const [{ next }] = await db
		.select({ next: sql<number>`coalesce(max(${module.orderIndex}) + 1, 0)` })
		.from(module)
		.where(and(eq(module.userId, userId), eq(module.courseId, courseId)));
	return db.insert(module).values({ userId, courseId, name, orderIndex: next });
}

export function renameModule(userId: string, id: number, name: string) {
	return db.update(module).set({ name }).where(and(eq(module.userId, userId), eq(module.id, id)));
}

export function deleteModule(userId: string, id: number) {
	return db.delete(module).where(and(eq(module.userId, userId), eq(module.id, id)));
}

export async function reorderModules(userId: string, orderedIds: number[]) {
	await db.transaction(async (tx) => {
		for (let i = 0; i < orderedIds.length; i++) {
			await tx
				.update(module)
				.set({ orderIndex: i })
				.where(and(eq(module.userId, userId), eq(module.id, orderedIds[i])));
		}
	});
}

export async function getModule(userId: string, id: number) {
	const [row] = await db
		.select()
		.from(module)
		.where(and(eq(module.userId, userId), eq(module.id, id)));
	return row ?? null;
}

export function listLessons(userId: string, moduleId: number) {
	return db
		.select()
		.from(lesson)
		.where(and(eq(lesson.userId, userId), eq(lesson.moduleId, moduleId)))
		.orderBy(lesson.orderIndex);
}

export async function createLesson(userId: string, moduleId: number, title: string) {
	const [{ next }] = await db
		.select({ next: sql<number>`coalesce(max(${lesson.orderIndex}) + 1, 0)` })
		.from(lesson)
		.where(and(eq(lesson.userId, userId), eq(lesson.moduleId, moduleId)));
	return db.insert(lesson).values({ userId, moduleId, title, orderIndex: next });
}

export function renameLesson(userId: string, id: number, title: string) {
	return db.update(lesson).set({ title }).where(and(eq(lesson.userId, userId), eq(lesson.id, id)));
}

export function deleteLesson(userId: string, id: number) {
	return db.delete(lesson).where(and(eq(lesson.userId, userId), eq(lesson.id, id)));
}

export async function reorderLessons(userId: string, orderedIds: number[]) {
	await db.transaction(async (tx) => {
		for (let i = 0; i < orderedIds.length; i++) {
			await tx
				.update(lesson)
				.set({ orderIndex: i })
				.where(and(eq(lesson.userId, userId), eq(lesson.id, orderedIds[i])));
		}
	});
}
