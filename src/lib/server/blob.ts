import { copy, del, head } from '@vercel/blob';
import { env } from '$env/dynamic/private';

// The SDK reads process.env.BLOB_READ_WRITE_TOKEN on Vercel, but Vite's dev
// server does not populate process.env from .env — so we pass the token
// explicitly (sourced from $env, which does see .env) for dev + prod parity.
const token = env.BLOB_READ_WRITE_TOKEN;

/** Copy an existing blob to a new pathname; returns the new url + pathname. */
export async function copyBlob(fromUrl: string, toPathname: string) {
	const result = await copy(fromUrl, toPathname, { access: 'public', token });
	return { blobUrl: result.url, pathname: result.pathname };
}

/** Delete a blob by its pathname (or url). */
export async function deleteBlob(pathname: string): Promise<void> {
	await del(pathname, { token });
}

/** Fetch blob metadata; throws if it does not exist. */
export async function headBlob(url: string) {
	return head(url, { token });
}
