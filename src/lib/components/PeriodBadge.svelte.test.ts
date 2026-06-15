import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import PeriodBadge from './PeriodBadge.svelte';

test('renders the period number and a P label', async () => {
	const screen = render(PeriodBadge, { period: 3, colour: '#5ba06e' });
	await expect.element(screen.getByText('3')).toBeInTheDocument();
	await expect.element(screen.getByText('P')).toBeInTheDocument();
});
