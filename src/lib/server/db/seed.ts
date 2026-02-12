import { db } from './index';
import { examSpec, topic, specPoint } from './schema';
import { eq, and } from 'drizzle-orm';

/**
 * Seeds the database with UK Physics exam specifications.
 * Includes GCSE and A-Level specifications for all major exam boards.
 * This function is idempotent - can be run multiple times safely.
 */
export async function seedExamSpecs() {
	// Helper to find or create exam spec
	const findOrCreateExamSpec = async (data: {
		board: string;
		level: 'GCSE' | 'A-Level';
		name: string;
		specCode?: string;
		specYear?: string;
	}) => {
		const existing = await db
			.select()
			.from(examSpec)
			.where(and(eq(examSpec.board, data.board), eq(examSpec.level, data.level)))
			.limit(1);

		if (existing.length > 0) {
			return existing[0];
		}

		const [created] = await db.insert(examSpec).values(data).returning();
		return created;
	};

	// Helper to find or create topic
	const findOrCreateTopic = async (data: {
		examSpecId: string;
		parentId: string | null;
		name: string;
		code?: string;
		description?: string;
		sortOrder: number;
	}) => {
		// For null parentId, we need to use a simpler query
		let existing;
		if (data.parentId === null) {
			existing = await db
				.select()
				.from(topic)
				.where(
					and(
						eq(topic.examSpecId, data.examSpecId),
						eq(topic.name, data.name)
						// Cannot use eq() with null in drizzle, so we filter in JS
					)
				)
				.limit(10);
			// Filter for null parentId in memory
			existing = existing.filter((t) => t.parentId === null);
		} else {
			existing = await db
				.select()
				.from(topic)
				.where(
					and(
						eq(topic.examSpecId, data.examSpecId),
						eq(topic.name, data.name),
						eq(topic.parentId, data.parentId)
					)
				)
				.limit(1);
		}

		if (existing.length > 0) {
			return existing[0];
		}

		const [created] = await db.insert(topic).values(data).returning();
		return created;
	};

	// Helper to find or create spec point
	const findOrCreateSpecPoint = async (data: {
		topicId: string;
		reference: string;
		content: string;
		notes?: string;
		tier?: 'foundation' | 'higher' | 'both';
		sortOrder: number;
	}) => {
		const existing = await db
			.select()
			.from(specPoint)
			.where(and(eq(specPoint.topicId, data.topicId), eq(specPoint.reference, data.reference)))
			.limit(1);

		if (existing.length > 0) {
			return existing[0];
		}

		await db.insert(specPoint).values(data);
	};

	// ==================== GCSE Specifications ====================

	// AQA GCSE Physics
	const aqaGcse = await findOrCreateExamSpec({
		board: 'AQA',
		level: 'GCSE',
		name: 'AQA GCSE Physics (8463)',
		specCode: '8463',
		specYear: '2016'
	});

	const aqaGcseEnergy = await findOrCreateTopic({
		examSpecId: aqaGcse.id,
		parentId: null,
		name: 'Energy',
		code: '4.1',
		description: 'Energy stores and transfers',
		sortOrder: 1
	});

	await findOrCreateSpecPoint({
		topicId: aqaGcseEnergy.id,
		reference: '4.1.1.1',
		content: 'Describe all the changes involved in the way energy is stored when a system changes',
		tier: 'both',
		sortOrder: 1
	});

	await findOrCreateSpecPoint({
		topicId: aqaGcseEnergy.id,
		reference: '4.1.1.2',
		content: 'Calculate the amount of energy associated with a moving object',
		tier: 'both',
		sortOrder: 2
	});

	const aqaGcseParticles = await findOrCreateTopic({
		examSpecId: aqaGcse.id,
		parentId: null,
		name: 'Particle model of matter',
		code: '4.2',
		description: 'Particle model and density',
		sortOrder: 2
	});

	await findOrCreateSpecPoint({
		topicId: aqaGcseParticles.id,
		reference: '4.2.1.1',
		content: 'Explain how the particle model of matter can explain density',
		tier: 'both',
		sortOrder: 1
	});

	const aqaGcseForces = await findOrCreateTopic({
		examSpecId: aqaGcse.id,
		parentId: null,
		name: 'Forces',
		code: '4.5',
		description: 'Forces and motion',
		sortOrder: 3
	});

	const aqaGcseForcesMotion = await findOrCreateTopic({
		examSpecId: aqaGcse.id,
		parentId: aqaGcseForces.id,
		name: 'Forces and motion',
		code: '4.5.1',
		sortOrder: 1
	});

	await findOrCreateSpecPoint({
		topicId: aqaGcseForcesMotion.id,
		reference: '4.5.1.1',
		content: 'Describe examples of the forces acting on an isolated object or system',
		tier: 'both',
		sortOrder: 1
	});

	await findOrCreateSpecPoint({
		topicId: aqaGcseForcesMotion.id,
		reference: '4.5.1.2',
		content:
			'Use free body diagrams to describe qualitatively examples where several forces lead to a resultant force on an object',
		tier: 'both',
		sortOrder: 2
	});

	// OCR Gateway GCSE Physics
	const ocrGatewayGcse = await findOrCreateExamSpec({
		board: 'OCR Gateway',
		level: 'GCSE',
		name: 'OCR Gateway GCSE Physics (J249)',
		specCode: 'J249',
		specYear: '2016'
	});

	const ocrGatewayMatter = await findOrCreateTopic({
		examSpecId: ocrGatewayGcse.id,
		parentId: null,
		name: 'Matter',
		code: 'P1',
		sortOrder: 1
	});

	await findOrCreateSpecPoint({
		topicId: ocrGatewayMatter.id,
		reference: '1.1',
		content:
			'Describe how and why the temperature of a gas increases when it is compressed quickly',
		tier: 'both',
		sortOrder: 1
	});

	// OCR 21st Century GCSE Physics
	const ocr21stGcse = await findOrCreateExamSpec({
		board: 'OCR 21st Century',
		level: 'GCSE',
		name: 'OCR 21st Century GCSE Physics (J257)',
		specCode: 'J257',
		specYear: '2016'
	});

	const ocr21stEnergy = await findOrCreateTopic({
		examSpecId: ocr21stGcse.id,
		parentId: null,
		name: 'Energy and electricity',
		code: 'P1',
		sortOrder: 1
	});

	await findOrCreateSpecPoint({
		topicId: ocr21stEnergy.id,
		reference: '1.1',
		content: 'Recall and use the equation for calculating energy transferred electrically',
		tier: 'both',
		sortOrder: 1
	});

	// Edexcel GCSE Physics
	const edexcelGcse = await findOrCreateExamSpec({
		board: 'Edexcel',
		level: 'GCSE',
		name: 'Edexcel GCSE Physics (1PH0)',
		specCode: '1PH0',
		specYear: '2016'
	});

	const edexcelMotion = await findOrCreateTopic({
		examSpecId: edexcelGcse.id,
		parentId: null,
		name: 'Motion and forces',
		code: '1',
		sortOrder: 1
	});

	await findOrCreateSpecPoint({
		topicId: edexcelMotion.id,
		reference: '1.1',
		content: 'Use the equation: distance travelled = average speed × time',
		tier: 'both',
		sortOrder: 1
	});

	// WJEC/Eduqas GCSE Physics
	const wjecGcse = await findOrCreateExamSpec({
		board: 'WJEC/Eduqas',
		level: 'GCSE',
		name: 'WJEC/Eduqas GCSE Physics',
		specYear: '2016'
	});

	const wjecElectricity = await findOrCreateTopic({
		examSpecId: wjecGcse.id,
		parentId: null,
		name: 'Electricity',
		code: '1',
		sortOrder: 1
	});

	await findOrCreateSpecPoint({
		topicId: wjecElectricity.id,
		reference: '1.1',
		content: 'Describe the structure of the atom',
		tier: 'both',
		sortOrder: 1
	});

	// ==================== A-Level Specifications ====================

	// AQA A-Level Physics
	const aqaALevel = await findOrCreateExamSpec({
		board: 'AQA',
		level: 'A-Level',
		name: 'AQA A-Level Physics (7408)',
		specCode: '7408',
		specYear: '2015'
	});

	const aqaALevelMechanics = await findOrCreateTopic({
		examSpecId: aqaALevel.id,
		parentId: null,
		name: 'Mechanics and materials',
		code: '3.4.1',
		sortOrder: 1
	});

	const aqaALevelForce = await findOrCreateTopic({
		examSpecId: aqaALevel.id,
		parentId: aqaALevelMechanics.id,
		name: 'Force, energy and momentum',
		code: '3.4.1.1',
		sortOrder: 1
	});

	await findOrCreateSpecPoint({
		topicId: aqaALevelForce.id,
		reference: '3.4.1.1.1',
		content: 'Understand that a scalar has magnitude only; a vector has magnitude and direction',
		sortOrder: 1
	});

	await findOrCreateSpecPoint({
		topicId: aqaALevelForce.id,
		reference: '3.4.1.1.2',
		content: 'Add vectors in one dimension and in two dimensions to determine a resultant',
		sortOrder: 2
	});

	const aqaALevelParticles = await findOrCreateTopic({
		examSpecId: aqaALevel.id,
		parentId: null,
		name: 'Particles and radiation',
		code: '3.2',
		sortOrder: 2
	});

	await findOrCreateSpecPoint({
		topicId: aqaALevelParticles.id,
		reference: '3.2.1.1',
		content:
			'Describe a simple model of the atom consisting of a small nucleus containing protons and neutrons',
		sortOrder: 1
	});

	// OCR A A-Level Physics
	const ocrAALevel = await findOrCreateExamSpec({
		board: 'OCR A',
		level: 'A-Level',
		name: 'OCR A A-Level Physics (H556)',
		specCode: 'H556',
		specYear: '2015'
	});

	const ocrAFoundations = await findOrCreateTopic({
		examSpecId: ocrAALevel.id,
		parentId: null,
		name: 'Development of practical skills',
		code: '1',
		sortOrder: 1
	});

	await findOrCreateSpecPoint({
		topicId: ocrAFoundations.id,
		reference: '1.1',
		content: 'Describe how to plan practical investigations',
		sortOrder: 1
	});

	// OCR B A-Level Physics
	const ocrBALevel = await findOrCreateExamSpec({
		board: 'OCR B',
		level: 'A-Level',
		name: 'OCR B (Advancing Physics) A-Level Physics (H557)',
		specCode: 'H557',
		specYear: '2015'
	});

	const ocrBImaging = await findOrCreateTopic({
		examSpecId: ocrBALevel.id,
		parentId: null,
		name: 'Imaging and signalling',
		code: '1',
		sortOrder: 1
	});

	await findOrCreateSpecPoint({
		topicId: ocrBImaging.id,
		reference: '1.1',
		content: 'Understand that waves carry energy and information',
		sortOrder: 1
	});

	// Edexcel A-Level Physics
	const edexcelALevel = await findOrCreateExamSpec({
		board: 'Edexcel',
		level: 'A-Level',
		name: 'Edexcel A-Level Physics (9PH0)',
		specCode: '9PH0',
		specYear: '2015'
	});

	const edexcelALevelMechanics = await findOrCreateTopic({
		examSpecId: edexcelALevel.id,
		parentId: null,
		name: 'Mechanics',
		code: '1',
		sortOrder: 1
	});

	await findOrCreateSpecPoint({
		topicId: edexcelALevelMechanics.id,
		reference: '1.1',
		content: 'Use graphs to find average and instantaneous velocity',
		sortOrder: 1
	});

	// WJEC/Eduqas A-Level Physics
	const wjecALevel = await findOrCreateExamSpec({
		board: 'WJEC/Eduqas',
		level: 'A-Level',
		name: 'WJEC/Eduqas A-Level Physics',
		specYear: '2015'
	});

	const wjecALevelMotion = await findOrCreateTopic({
		examSpecId: wjecALevel.id,
		parentId: null,
		name: 'Basic physics',
		code: '1',
		sortOrder: 1
	});

	await findOrCreateSpecPoint({
		topicId: wjecALevelMotion.id,
		reference: '1.1',
		content: 'Understand the concept of a physical quantity',
		sortOrder: 1
	});
}
