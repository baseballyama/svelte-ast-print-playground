import { expect, test } from '@playwright/test';
import { print } from 'svelte-ast-print';
import { parse } from 'svelte/compiler';
import { codeFromUrl, defaultSvelte, editor, hashFor, invalidSvelte, open } from './helpers';

// Expected panel contents come from the same libraries, run in Node, so the
// browser output is compared exactly rather than by a fragment.
const expectedAst = (code: string) => JSON.stringify(parse(code, { modern: true }), null, 2);
const expectedPrint = (code: string) => print(parse(code, { modern: true })).code;

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
	await open(page, hashFor(invalidSvelte));
	await expect(page.getByText('Parse error', { exact: true })).toBeVisible();
	const alert = page.getByRole('alert');
	await expect(alert.locator('strong')).toHaveText(
		'`</span>` attempted to close an element that was not open'
	);
	await expect(alert.locator('span')).toHaveText('Line 2, column 1');
	await expect(alert.getByRole('link', { name: 'About this error' })).toHaveAttribute(
		'href',
		'https://svelte.dev/e/element_invalid_closing_tag'
	);

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

test('Copy and Copy JSON put the exact printed output and AST on the clipboard', async ({
	page,
	context
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await open(page);
	const clipboard = () => page.evaluate(() => navigator.clipboard.readText());

	await show(page, 'Printed');
	await page.getByRole('button', { name: 'Copy', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('Output copied');
	expect(await clipboard()).toBe(expectedPrint(defaultSvelte));

	await show(page, 'AST');
	await page.getByRole('button', { name: 'Copy JSON' }).click();
	await expect(page.getByRole('status')).toHaveText('AST copied');
	expect(await clipboard()).toBe(expectedAst(defaultSvelte));
});

test('reports a failed copy', async ({ page }) => {
	await page.addInitScript(() => {
		navigator.clipboard.writeText = () => Promise.reject(new Error('denied'));
	});
	await open(page);
	await page.getByRole('button', { name: 'Copy share link' }).click();
	await expect(page.getByRole('status')).toHaveText('Copy failed');
});

test('opens links shared before the redesign', async ({ page }) => {
	// A literal hash, not one built by the helper, so a change to the encoding
	// cannot silently break URLs people already shared.
	await open(page, '#DwCwjAfAyiCGBOBTAJgAgEaIGYHsmoBcRFUllEBnASwHMA7YAenAiA');
	await expect(editor(page, 'Svelte input')).toHaveText('<h1>Shared before the redesign</h1>');
});

test('read-only panels take keyboard focus but reject edits', async ({ page }, testInfo) => {
	test.skip(isMobile(testInfo.project.name), 'desktop keyboard flow');
	await open(page);
	const output = editor(page, 'Printed Svelte output');
	await output.focus();
	await expect(output).toBeFocused();
	await expect(output).toHaveAttribute('aria-readonly', 'true');
	await page.keyboard.insertText('typed');
	await expect(output).not.toContainText('typed');
});

test('panels are tabpanels only while they are shown as tabs', async ({ page }, testInfo) => {
	await open(page);
	if (isMobile(testInfo.project.name)) {
		await expect(page.getByRole('tabpanel', { name: 'Svelte' })).toBeVisible();
		await page.getByRole('tab', { name: 'AST' }).click();
		await expect(page.getByRole('tabpanel', { name: 'AST' })).toBeVisible();
	} else {
		await expect(page.getByRole('tabpanel')).toHaveCount(0);
		await expect(page.getByRole('region', { name: /^AST/ })).toBeVisible();
	}
});
