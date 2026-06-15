export type LinkType = 'youtube' | 'onedrive' | 'google' | 'link';

export function linkMeta(url: string): { type: LinkType; host: string } {
	const low = url.toLowerCase();
	const host = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
	let type: LinkType = 'link';
	if (low.includes('youtube') || low.includes('youtu.be')) type = 'youtube';
	else if (low.includes('onedrive') || low.includes('1drv') || low.includes('sharepoint'))
		type = 'onedrive';
	else if (
		low.includes('docs.google') ||
		low.includes('drive.google') ||
		low.includes('google.')
	)
		type = 'google';
	return { type, host: host || url };
}

export function fileMeta(name: string): { kind: string; bg: string; fg: string } {
	const ext = (name.split('.').pop() || '').toLowerCase();
	if (ext === 'pdf') return { kind: 'PDF', bg: '#fbe3e3', fg: '#c0504d' };
	if (ext === 'doc' || ext === 'docx') return { kind: 'DOC', bg: '#e2ecf7', fg: '#3f6aa3' };
	if (ext === 'ppt' || ext === 'pptx') return { kind: 'PPT', bg: '#fbe9dd', fg: '#b06a3d' };
	if (['xls', 'xlsx', 'csv'].includes(ext)) return { kind: 'XLS', bg: '#e3f1e7', fg: '#3e7c50' };
	if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(ext))
		return { kind: 'IMG', bg: '#ebe6f6', fg: '#6553a0' };
	return { kind: 'FILE', bg: '#f0ecf2', fg: '#7a7280' };
}

export const LINK_TILE: Record<LinkType, { bg: string; fg: string }> = {
	youtube: { bg: '#fbe3e3', fg: '#c0504d' },
	onedrive: { bg: '#e2ecf7', fg: '#3f6aa3' },
	google: { bg: '#e3f1e7', fg: '#3e7c50' },
	link: { bg: '#f0ecf2', fg: '#7a7280' }
};

export const LINK_ICON: Record<LinkType, string> = {
	youtube: '<path d="M9.4 8.3v7.4l6.2-3.7-6.2-3.7Z"/>',
	onedrive:
		'<path d="M7 18.5a3.5 3.5 0 0 1-.4-6.98A5 5 0 0 1 16 9.2a3.3 3.3 0 0 1 1 6.5"/><path d="M7 18.5h9.5"/>',
	google:
		'<path d="M14 3v5h5"/><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/>',
	link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>'
};
