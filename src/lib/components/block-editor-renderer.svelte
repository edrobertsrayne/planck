<script lang="ts">
	interface Block {
		type: string;
		data: Record<string, unknown>;
	}

	interface EditorData {
		blocks: Block[];
	}

	interface Props {
		data: string | null;
		class?: string;
	}

	let { data, class: className = '' }: Props = $props();

	let blocks = $derived.by(() => {
		if (!data) return [];
		try {
			const parsed = JSON.parse(data) as EditorData;
			return parsed.blocks ?? [];
		} catch {
			return [];
		}
	});

	function escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	function renderBlock(block: Block): string {
		const d = block.data;
		switch (block.type) {
			case 'paragraph':
				return `<p>${d.text}</p>`;
			case 'header': {
				const level = (d.level as number) || 2;
				return `<h${level}>${d.text}</h${level}>`;
			}
			case 'list': {
				const tag = d.style === 'ordered' ? 'ol' : 'ul';
				const items = (d.items as string[]) || [];
				return `<${tag}>${items.map((i) => `<li>${i}</li>`).join('')}</${tag}>`;
			}
			case 'checklist': {
				const items = (d.items as Array<{ text: string; checked: boolean }>) || [];
				return `<ul class="checklist">${items
					.map(
						(i) =>
							`<li class="${i.checked ? 'checked' : ''}">${i.checked ? '&#9745;' : '&#9744;'} ${i.text}</li>`
					)
					.join('')}</ul>`;
			}
			case 'quote':
				return `<blockquote><p>${d.text}</p>${d.caption ? `<cite>${d.caption}</cite>` : ''}</blockquote>`;
			case 'code':
				return `<pre><code>${escapeHtml(d.code as string)}</code></pre>`;
			case 'delimiter':
				return '<hr />';
			case 'table': {
				const content = (d.content as string[][]) || [];
				const withHeadings = d.withHeadings as boolean;
				if (content.length === 0) return '';
				let html = '<table>';
				content.forEach((row, i) => {
					const tag = withHeadings && i === 0 ? 'th' : 'td';
					html += '<tr>' + row.map((cell) => `<${tag}>${cell}</${tag}>`).join('') + '</tr>';
				});
				html += '</table>';
				return html;
			}
			default:
				return '';
		}
	}
</script>

{#if blocks.length > 0}
	<div class="block-renderer prose prose-sm dark:prose-invert max-w-none {className}">
		{#each blocks as block (block)}
			{@html renderBlock(block)}
		{/each}
	</div>
{/if}
