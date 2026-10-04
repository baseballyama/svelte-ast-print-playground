import { test } from '@playwright/test';
import { hashFor, invalidSvelte, open } from './helpers';

// UI-agnostic captures used for before / after comparison: they only rely on
// the URL hash and CodeMirror, so they also run against the previous UI.
const dir = process.env.SHOTS_DIR ?? 'test-results/screens';
const states = {
	default: { hash: '', tab: null },
	error: { hash: hashFor(invalidSvelte), tab: null },
	// On narrow screens the redesign shows one panel at a time; the previous UI
	// has no tabs, so these capture the same page as `default` there.
	printed: { hash: '', tab: 'Printed' },
	ast: { hash: '', tab: 'AST' }
} as const;

for (const [state, { hash, tab }] of Object.entries(states)) {
	for (const scheme of ['light', 'dark'] as const) {
		test(`@shots ${state} (${scheme})`, async ({ page }, testInfo) => {
			const device = testInfo.project.name.replace('shots-', '');
			test.skip(tab !== null && device !== 'mobile', 'tabs only exist on narrow screens');
			await page.emulateMedia({ colorScheme: scheme });
			await open(page, hash);
			if (tab) {
				const button = page.getByRole('tab', { name: tab });
				if (await button.isVisible()) await button.click();
			}
			await page.screenshot({ path: `${dir}/${device}-${state}-${scheme}.png`, fullPage: true });
		});
	}
}
