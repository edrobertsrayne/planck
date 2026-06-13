import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const db = drizzle(neon(url));

// Give each class's existing rows a contiguous order_index based on their
// current chronological placement. Overflow rows (null date) sort last.
await db.execute(sql`
	UPDATE scheduled_lesson s
	SET order_index = sub.rn - 1
	FROM (
		SELECT id, ROW_NUMBER() OVER (
			PARTITION BY user_id, class_id
			ORDER BY date ASC NULLS LAST, period ASC NULLS LAST
		) AS rn
		FROM scheduled_lesson
	) sub
	WHERE s.id = sub.id;
`);
console.log('Backfilled scheduled_lesson.order_index');
