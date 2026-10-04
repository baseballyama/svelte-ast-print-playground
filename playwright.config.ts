import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const base = '/svelte-ast-print-playground/';

// BASE_URL lets the screenshot spec run against another build (e.g. `main`)
// that is already being served; otherwise this branch is built and previewed.
export default defineConfig({
	testDir: 'e2e',
	forbidOnly: !!process.env.CI,
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL: process.env.BASE_URL ?? `http://localhost:${port}${base}`,
		trace: 'retain-on-failure'
	},
	webServer: process.env.BASE_URL
		? undefined
		: {
				command: `pnpm run build && pnpm exec vite preview --port ${port} --strictPort`,
				url: `http://localhost:${port}${base}`,
				timeout: 180_000
			},
	// `@shots` only captures screenshots for the before / after comparison, so
	// it runs as its own projects and does not count towards the e2e results.
	projects: [
		{
			name: 'desktop',
			grepInvert: /@shots/,
			use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
		},
		{ name: 'mobile', grepInvert: /@shots/, use: { ...devices['Pixel 7'] } },
		{
			name: 'shots-desktop',
			grep: /@shots/,
			use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
		},
		{ name: 'shots-mobile', grep: /@shots/, use: { ...devices['Pixel 7'] } }
	]
});
