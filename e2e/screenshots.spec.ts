import { test } from '@playwright/test';
import { hashFor, invalidSvelte, open } from './helpers';

// UI-agnostic captures used for before / after comparison: they only rely on
// the URL hash and CodeMirror, so they also run against the previous UI.
const dir = process.env.SHOTS_DIR ?? 'test-results/screens';
const states = {
	default: '',
	error: hashFor(invalidSvelte)
};

for (const [state, hash] of Object.entries(states)) {
	for (const scheme of ['light', 'dark'] as const) {
		test(`@shots ${state} (${scheme})`, async ({ page }, testInfo) => {
			await page.emulateMedia({ colorScheme: scheme });
			await open(page, hash);
			await page.screenshot({
				path: `${dir}/${testInfo.project.name}-${state}-${scheme}.png`,
				fullPage: true
			});
		});
	}
}
