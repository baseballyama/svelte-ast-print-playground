import { expect, test } from '@playwright/test';
import { codeFromUrl, defaultSvelte, editor, hashFor, open } from './helpers';

const isMobile = (name: string) => name === 'mobile';

/** On narrow screens only the selected panel is shown. */
async function show(page: import('@playwright/test').Page, tab: 'Svelte' | 'Printed' | 'AST') {
	const tabButton = page.getByRole('tab', { name: tab });
	if (await tabButton.isVisible()) await tabButton.click();
}

test('renders the default example in all three panels', async ({ page }) => {
	await open(page);
	await expect(editor(page, 'Svelte input')).toContainText(
		'const props: { foo: string } = $props();'
	);
	await expect(page.getByText('Parsed', { exact: true })).toBeVisible();

	await show(page, 'Printed');
	// svelte-ast-print indents with tabs, so the round trip is reformatted, not identical.
	await expect(editor(page, 'Printed Svelte output')).toContainText('<div>Hi!</div>');
	await expect(page.getByText('Reformatted', { exact: true })).toBeVisible();

	await show(page, 'AST');
	await expect(editor(page, 'Svelte AST as JSON')).toContainText('"type": "Root"');
	expect(codeFromUrl(page.url())).toBe(defaultSvelte);
});

test('editing updates the output and the share hash, and the hash restores it', async ({
	page
}) => {
	await open(page);
	const input = editor(page, 'Svelte input');
	await input.click();
	await page.keyboard.press('ControlOrMeta+a');
	await page.keyboard.insertText('<p>{1 + 1}</p>');

	await show(page, 'Printed');
	await expect(editor(page, 'Printed Svelte output')).toHaveText('<p>{1 + 1}</p>');
	await expect(page.getByText('Identical to input', { exact: true })).toBeVisible();
	await expect.poll(() => codeFromUrl(page.url())).toBe('<p>{1 + 1}</p>');

	await page.reload();
	await expect(page.locator('.cm-content')).toHaveCount(3);
	await show(page, 'Svelte');
	await expect(editor(page, 'Svelte input')).toHaveText('<p>{1 + 1}</p>');
});

test('shows parse errors with the compiler message and location', async ({ page }) => {
	await open(page, hashFor('<div>\n  <span>\n</div>'));
	await expect(page.getByText('Parse error', { exact: true })).toBeVisible();
	const alert = page.getByRole('alert');
	await expect(alert).toContainText('attempted to close an element that was not open');
	await expect(alert).toContainText(/Line 3, column \d+/);

	await show(page, 'Printed');
	await expect(editor(page, 'Printed Svelte output')).toHaveText('Error parsing Svelte code');
	await expect(page.getByRole('button', { name: 'Copy', exact: true })).toBeDisabled();
	await show(page, 'AST');
	await expect(page.getByRole('button', { name: 'Copy JSON' })).toBeDisabled();
});

test('Reset example restores the default input', async ({ page }) => {
	await open(page, hashFor('<p>custom</p>'));
	await page.getByRole('button', { name: 'Reset example' }).click();
	await show(page, 'Svelte');
	await expect(editor(page, 'Svelte input')).toContainText(
		'const props: { foo: string } = $props();'
	);
	await expect.poll(() => codeFromUrl(page.url())).toBe(defaultSvelte);
});

test('Copy share link puts the current URL on the clipboard', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await open(page, hashFor('<p>share me</p>'));
	await page.getByRole('button', { name: 'Copy share link' }).click();
	await expect(page.getByRole('status')).toHaveText('Link copied');
	const clipboard = await page.evaluate(() => navigator.clipboard.readText());
	expect(codeFromUrl(clipboard)).toBe('<p>share me</p>');
});

test('Tab moves keyboard focus out of the editor', async ({ page }, testInfo) => {
	test.skip(isMobile(testInfo.project.name), 'desktop keyboard flow');
	await open(page);
	await editor(page, 'Svelte input').click();
	await expect(editor(page, 'Svelte input')).toBeFocused();
	await page.keyboard.press('Tab');
	// The editor does not bind Tab, so focus must not be trapped inside it.
	await expect(editor(page, 'Svelte input')).not.toBeFocused();
});

test('tabs switch panels with the arrow, Home and End keys', async ({ page }, testInfo) => {
	test.skip(!isMobile(testInfo.project.name), 'tabs only exist on narrow screens');
	await open(page);
	const svelteTab = page.getByRole('tab', { name: 'Svelte' });
	await svelteTab.focus();
	await expect(svelteTab).toHaveAttribute('aria-selected', 'true');
	await expect(editor(page, 'Svelte input')).toBeVisible();
	await expect(editor(page, 'Printed Svelte output')).toBeHidden();

	await page.keyboard.press('ArrowRight');
	await expect(page.getByRole('tab', { name: 'Printed' })).toBeFocused();
	await expect(page.getByRole('tab', { name: 'Printed' })).toHaveAttribute('aria-selected', 'true');
	await expect(editor(page, 'Printed Svelte output')).toBeVisible();
	await expect(editor(page, 'Svelte input')).toBeHidden();

	await page.keyboard.press('End');
	await expect(page.getByRole('tab', { name: 'AST' })).toHaveAttribute('aria-selected', 'true');
	await page.keyboard.press('ArrowRight');
	await expect(page.getByRole('tab', { name: 'Svelte' })).toHaveAttribute('aria-selected', 'true');
	await page.keyboard.press('ArrowLeft');
	await expect(page.getByRole('tab', { name: 'AST' })).toHaveAttribute('aria-selected', 'true');
	await page.keyboard.press('Home');
	await expect(page.getByRole('tab', { name: 'Svelte' })).toHaveAttribute('aria-selected', 'true');
});

test('has no horizontal overflow', async ({ page }) => {
	await open(page);
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
});
