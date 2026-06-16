// Inner SVG markup (paste inside an <svg viewBox="0 0 24 24" ...>). Path data
// copied verbatim from docs/design-reference/Planck.dc.html.
export const ICON = {
	check: '<path d="M20 6 9 17l-5-5"/>',
	close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
	plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
	chevronRight: '<path d="m9 18 6-6-6-6"/>',
	chevronLeft: '<path d="m15 18-6-6 6-6"/>',
	arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
	clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
	pin: '<path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.4"/>',
	link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>',
	file: '<path d="M14 3v5h5"/><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/>',
	trash:
		'<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
	pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
	grip: '<circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>'
};
