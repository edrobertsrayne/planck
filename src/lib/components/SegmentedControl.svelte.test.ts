import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import SegmentedControl from './SegmentedControl.svelte';

test('selecting an option calls onchange with its value', async () => {
	const onchange = vi.fn();
	const screen = render(SegmentedControl, {
		value: 'A',
		options: [{ value: 'A', label: 'Week A' }, { value: 'B', label: 'Week B' }],
		onchange
	});
	await screen.getByText('Week B').click();
	expect(onchange).toHaveBeenCalledWith('B');
});
