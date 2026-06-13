import { copy, del, head } from '@vercel/blob';

/** Copy an existing blob to a new pathname; returns the new url + pathname. */
export async function copyBlob(fromUrl: string, toPathname: string) {
	const result = await copy(fromUrl, toPathname, { access: 'public' });
	return { blobUrl: result.url, pathname: result.pathname };
}

/** Delete a blob by its pathname (or url). */
export async function deleteBlob(pathname: string): Promise<void> {
	await del(pathname);
}

/** Fetch blob metadata; throws if it does not exist. */
export async function headBlob(url: string) {
	return head(url);
}
