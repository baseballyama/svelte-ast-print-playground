import { expect, type Page } from '@playwright/test';
import LZString from 'lz-string';

export const defaultSvelte = `<script lang="ts">
  const props: { foo: string } = $props();
</script>

<div>Hi!</div>`;

/** The URL fragment the playground uses to share `code`. */
export const hashFor = (code: string) => `#${LZString.compressToEncodedURIComponent(code)}`;

export const codeFromUrl = (url: string) =>
	LZString.decompressFromEncodedURIComponent(new URL(url).hash.slice(1));

/** Opens the playground and waits until all three editors are mounted. */
export async function open(page: Page, hash = '') {
	await page.goto(hash);
	await expect(page.locator('.cm-content')).toHaveCount(3);
}

export const editor = (page: Page, label: string) =>
	page.locator(`.cm-content[aria-label="${label}"]`);
