import { del, head } from '@vercel/blob';
import { env } from '$env/dynamic/private';

// The SDK reads process.env.BLOB_READ_WRITE_TOKEN on Vercel, but Vite's dev
// server does not populate process.env from .env — so we pass the token
// explicitly (sourced from $env, which does see .env) for dev + prod parity.
const token = env.BLOB_READ_WRITE_TOKEN;

/** Delete a blob by its pathname (or url). */
export async function deleteBlob(pathname: string): Promise<void> {
	await del(pathname, { token });
}

/** Delete many blobs by pathname, chunked to stay within API/timeout limits. */
export async function deleteBlobs(pathnames: string[]): Promise<void> {
	if (pathnames.length === 0) return;
	const CHUNK = 100;
	for (let i = 0; i < pathnames.length; i += CHUNK) {
		await del(pathnames.slice(i, i + CHUNK), { token });
	}
}

/** Fetch blob metadata; throws if it does not exist. */
export async function headBlob(url: string) {
	return head(url, { token });
}
