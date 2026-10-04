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
	projects: [
		{
			name: 'desktop',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
		},
		{ name: 'mobile', use: { ...devices['Pixel 7'] } }
	]
});
