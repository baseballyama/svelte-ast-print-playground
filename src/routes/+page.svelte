<script lang="ts">
	import { print } from 'svelte-ast-print';
	import { parse } from 'svelte/compiler';
	import Editor from '#lib/Editor.svelte';
	import LZString from 'lz-string';
	import { tick } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';

	const tag = 'script';
	const defaultSvelte = `\
<${tag} lang="ts">
  const props: { foo: string } = $props();
</${tag}>

<div>Hi!</div>`;

	type Panel = 'input' | 'output' | 'ast';
	const panels: { id: Panel; label: string }[] = [
		{ id: 'input', label: 'Svelte' },
		{ id: 'output', label: 'Printed' },
		{ id: 'ast', label: 'AST' }
	];

	// Matches the CSS breakpoint: below it the panels become tabs, and only then
	// do they carry the tabpanel role.
	const narrow = new MediaQuery('max-width: 860px');

	function getInitialSvelte() {
		const hash = location.hash.slice(1);
		if (hash) {
			try {
				const decompressed = LZString.decompressFromEncodedURIComponent(hash);
				if (decompressed) {
					return decompressed;
				}
			} catch (e) {
				console.error(e);
			}
		}
		history.replaceState(null, '', location.pathname);
		return defaultSvelte;
	}

	/** Human-readable message for an error thrown by `parse` or `print`. */
	function describe(e: unknown) {
		if (!(e instanceof Error)) return { message: String(e), location: '', docs: '' };
		// Svelte's CompileError carries `code` and `start: { line, column }` (column is 0-based).
		const { code, start } = e as { code?: string; start?: { line: number; column: number } };
		// The message's later lines repeat the docs URL that `code` already gives us.
		const message = e.message.split('\n')[0] ?? e.message;
		return {
			message,
			location: start ? `Line ${start.line}, column ${start.column + 1}` : '',
			docs: code ? `https://svelte.dev/e/${code}` : ''
		};
	}

	let svelte = $state(getInitialSvelte());
	let parsed = $derived.by(() => {
		try {
			return { ast: parse(svelte, { modern: true }), error: null };
		} catch (e) {
			console.error(e);
			return { ast: null, error: describe(e) };
		}
	});
	let printed = $derived.by(() => {
		if (!parsed.ast) return { code: 'Error parsing Svelte code', error: null };
		try {
			return { code: print(parsed.ast).code, error: null };
		} catch (e) {
			console.error(e);
			return { code: 'Error printing AST', error: describe(e) };
		}
	});
	let astJson = $derived(JSON.stringify(parsed.ast, null, 2));
	let roundTrip = $derived(
		parsed.error || printed.error ? null : printed.code === svelte ? 'identical' : 'reformatted'
	);

	let activePanel: Panel = $state('input');
	let copied: string | null = $state(null);
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		const encoded = LZString.compressToEncodedURIComponent(svelte);
		history.replaceState(null, '', `#${encoded}`);
	});

	async function copy(text: string, what: string) {
		// Clear first so a repeated copy is announced again by the live region.
		copied = null;
		await tick();
		try {
			await navigator.clipboard.writeText(text);
			copied = what;
		} catch (e) {
			console.error(e);
			copied = 'Copy failed';
		}
		clearTimeout(copiedTimer);
		copiedTimer = setTimeout(() => (copied = null), 2000);
	}

	function reset() {
		svelte = defaultSvelte;
	}

	// Roving focus for the small-screen tab bar (WAI-ARIA tabs pattern).
	function onTabKeydown(event: KeyboardEvent) {
		const index = panels.findIndex((p) => p.id === activePanel);
		const targets: Record<string, number> = {
			ArrowRight: (index + 1) % panels.length,
			ArrowLeft: (index - 1 + panels.length) % panels.length,
			Home: 0,
			End: panels.length - 1
		};
		const next = targets[event.key];
		if (next === undefined) return;
		event.preventDefault();
		activePanel = panels[next]!.id;
		document.getElementById(`tab-${activePanel}`)?.focus();
	}
</script>

<svelte:head>
	<title>svelte-ast-print Playground</title>
	<meta
		name="description"
		content="Parse Svelte into an AST and print it back with svelte-ast-print."
	/>
</svelte:head>

<div class="app">
	<header class="topbar">
		<div class="brand">
			<h1>svelte-ast-print <span>Playground</span></h1>
			<p class="tagline">Svelte → AST → Svelte, live in your browser</p>
		</div>
		<nav class="actions" aria-label="Playground actions">
			<button type="button" class="button" onclick={() => copy(location.href, 'Link copied')}>
				Copy share link
			</button>
			<button type="button" class="button ghost" onclick={reset}>Reset example</button>
			<a
				class="link"
				href="https://github.com/xeho91/svelte-ast-print?tab=readme-ov-file"
				target="_blank"
				rel="noreferrer">svelte-ast-print on GitHub</a
			>
			<a
				class="link"
				href="https://github.com/baseballyama/svelte-ast-print-playground"
				target="_blank"
				rel="noreferrer">Playground on GitHub</a
			>
		</nav>
	</header>

	<p class="toast" role="status" aria-live="polite">{copied ?? ''}</p>

	<div class="tabs" role="tablist" aria-label="Panels">
		{#each panels as panel (panel.id)}
			<button
				type="button"
				role="tab"
				id="tab-{panel.id}"
				aria-controls="panel-{panel.id}"
				aria-selected={activePanel === panel.id}
				tabindex={activePanel === panel.id ? 0 : -1}
				onclick={() => (activePanel = panel.id)}
				onkeydown={onTabKeydown}
			>
				{panel.label}
				{#if panel.id === 'input' && parsed.error}<span class="dot error" aria-hidden="true"
					></span><span class="visually-hidden">(parse error)</span>{/if}
			</button>
		{/each}
	</div>

	<main class="workspace">
		<section
			class="panel input"
			id="panel-input"
			role={narrow.current ? 'tabpanel' : undefined}
			aria-labelledby={narrow.current ? 'tab-input' : 'heading-input'}
			data-active={activePanel === 'input'}
		>
			<header class="panel-header">
				<h2 id="heading-input">Svelte <span class="hint">input</span></h2>
				{#if parsed.error}
					<span class="badge error">Parse error</span>
				{:else}
					<span class="badge ok">Parsed</span>
				{/if}
			</header>
			<div class="panel-body">
				<Editor bind:code={svelte} editable={true} label="Svelte input" />
			</div>
			{#if parsed.error}
				<div class="problem" role="alert">
					<strong>{parsed.error.message}</strong>
					{#if parsed.error.location}<span>{parsed.error.location}</span>{/if}
					{#if parsed.error.docs}<a href={parsed.error.docs} target="_blank" rel="noreferrer"
							>About this error</a
						>{/if}
				</div>
			{/if}
		</section>

		<section
			class="panel output"
			id="panel-output"
			role={narrow.current ? 'tabpanel' : undefined}
			aria-labelledby={narrow.current ? 'tab-output' : 'heading-output'}
			data-active={activePanel === 'output'}
		>
			<header class="panel-header">
				<h2 id="heading-output">Printed <span class="hint">Svelte → AST → Svelte</span></h2>
				{#if roundTrip === 'identical'}
					<span class="badge ok">Identical to input</span>
				{:else if roundTrip === 'reformatted'}
					<span class="badge neutral">Reformatted</span>
				{:else if printed.error}
					<span class="badge error">Print error</span>
				{/if}
				<button
					type="button"
					class="button small"
					disabled={!!(parsed.error || printed.error)}
					onclick={() => copy(printed.code, 'Output copied')}>Copy</button
				>
			</header>
			<div class="panel-body">
				<Editor code={printed.code} editable={false} label="Printed Svelte output" />
			</div>
			{#if printed.error}
				<div class="problem" role="alert">
					<strong>{printed.error.message}</strong>
					{#if printed.error.docs}<a href={printed.error.docs} target="_blank" rel="noreferrer"
							>About this error</a
						>{/if}
				</div>
			{/if}
		</section>

		<section
			class="panel ast"
			id="panel-ast"
			role={narrow.current ? 'tabpanel' : undefined}
			aria-labelledby={narrow.current ? 'tab-ast' : 'heading-ast'}
			data-active={activePanel === 'ast'}
		>
			<header class="panel-header">
				<h2 id="heading-ast">AST <span class="hint">svelte/compiler · modern</span></h2>
				<button
					type="button"
					class="button small"
					disabled={!parsed.ast}
					onclick={() => copy(astJson, 'AST copied')}>Copy JSON</button
				>
			</header>
			<div class="panel-body">
				<Editor code={astJson} editable={false} label="Svelte AST as JSON" />
			</div>
		</section>
	</main>
</div>

<style>
	:global(:root) {
		color-scheme: light dark;
		--font-sans:
			ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
			sans-serif;
		--font-mono:
			ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
		--code-size: 13px;
		--radius: 10px;

		--bg: #f6f7f9;
		--surface: #ffffff;
		--surface-raised: #f0f2f5;
		--border: #dfe3e8;
		--text: #1d2229;
		--text-muted: #59616d;
		--text-faint: #646b76;
		--accent: #cf3a24;
		--accent-contrast: #ffffff;
		--accent-text: #b4321f;
		--active-line: #f4f6f9;
		--selection: #ffd7cf;
		--ok-bg: #e5f5ec;
		--ok-text: #17663a;
		--error-bg: #fdeceb;
		--error-text: #a8241a;
		--neutral-bg: #eef1f5;
		--neutral-text: #4a5260;
		--tab-selected: #ffffff;
		/* Syntax colours, each at least 4.5:1 on --surface and --active-line. */
		--tok-keyword: #c21f2c;
		--tok-string: #0a3069;
		--tok-constant: #0550ae;
		--tok-property: #8a3500;
		--tok-type: #7139c9;
		--tok-tag: #116329;
		--tok-comment: #626b75;
	}

	@media (prefers-color-scheme: dark) {
		:global(:root) {
			--bg: #0f1115;
			--surface: #161a20;
			--surface-raised: #1e232b;
			--border: #2a3039;
			--text: #e6e9ee;
			--text-muted: #a5adba;
			--text-faint: #8a93a0;
			--accent: #ff6a4d;
			--accent-contrast: #0f1115;
			--accent-text: #ff8a73;
			--active-line: #1b2027;
			--selection: #5a2a22;
			--ok-bg: #12301f;
			--ok-text: #7dd9a2;
			--error-bg: #3a1714;
			--error-text: #ff9b91;
			--neutral-bg: #232933;
			--neutral-text: #b8c0cc;
			--tab-selected: #2c333e;
			--tok-keyword: #ff7b72;
			--tok-string: #a5d6ff;
			--tok-constant: #79c0ff;
			--tok-property: #ffa657;
			--tok-type: #d2a8ff;
			--tok-tag: #7ee787;
			--tok-comment: #9aa4b0;
		}
	}

	:global(body) {
		background: var(--bg);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: 14px;
		line-height: 1.5;
		-webkit-font-smoothing: antialiased;
	}

	.app {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		padding: 16px 20px 20px;
		gap: 12px;
	}

	.topbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px 24px;
	}

	h1 {
		font-size: 18px;
		font-weight: 650;
		letter-spacing: -0.01em;
	}

	h1 span {
		color: var(--accent-text);
	}

	.tagline {
		color: var(--text-muted);
		font-size: 13px;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
	}

	.button {
		font: inherit;
		font-size: 13px;
		font-weight: 550;
		padding: 6px 12px;
		border-radius: 8px;
		border: 1px solid var(--accent);
		background: var(--accent);
		color: var(--accent-contrast);
		cursor: pointer;
	}

	.button.ghost {
		background: transparent;
		color: var(--text);
		border-color: var(--border);
	}

	.button.small {
		padding: 3px 10px;
		font-size: 12px;
		background: var(--surface-raised);
		color: var(--text);
		border-color: var(--border);
	}

	.button:hover:not(:disabled) {
		filter: brightness(1.05);
	}

	.button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.link {
		color: var(--text-muted);
		font-size: 13px;
		text-underline-offset: 3px;
	}

	.link:hover {
		color: var(--text);
	}

	:is(.button, .link, [role='tab']):focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.toast {
		position: fixed;
		right: 20px;
		bottom: 20px;
		margin: 0;
		padding: 0;
		z-index: 10;
	}

	.toast:not(:empty) {
		padding: 8px 14px;
		border-radius: 8px;
		background: var(--text);
		color: var(--bg);
		font-size: 13px;
	}

	.workspace {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
		grid-template-areas:
			'input ast'
			'output ast';
		gap: 12px;
	}

	.panel {
		display: flex;
		flex-direction: column;
		min-height: 0;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.input {
		grid-area: input;
	}

	.output {
		grid-area: output;
	}

	.ast {
		grid-area: ast;
	}

	.panel-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
		background: var(--surface-raised);
	}

	.panel-header h2 {
		font-size: 13px;
		font-weight: 650;
		margin-right: auto;
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.hint {
		font-weight: 450;
		color: var(--text-faint);
		font-size: 12px;
	}

	.panel-body {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.badge {
		font-size: 11px;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 999px;
		white-space: nowrap;
	}

	.badge.ok {
		background: var(--ok-bg);
		color: var(--ok-text);
	}

	.badge.error {
		background: var(--error-bg);
		color: var(--error-text);
	}

	.badge.neutral {
		background: var(--neutral-bg);
		color: var(--neutral-text);
	}

	.problem {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		padding: 8px 12px;
		border-top: 1px solid var(--border);
		background: var(--error-bg);
		color: var(--error-text);
		font-size: 13px;
	}

	.problem span {
		font-family: var(--font-mono);
		font-size: 12px;
	}

	.problem a {
		color: inherit;
		font-size: 12px;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.tabs {
		display: none;
	}

	.dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		margin-left: 6px;
		vertical-align: middle;
	}

	.dot.error {
		background: var(--error-text);
	}

	@media (max-width: 860px) {
		.app {
			padding: 12px;
			height: auto;
			min-height: 100dvh;
		}

		.tabs {
			display: flex;
			gap: 4px;
			padding: 4px;
			border-radius: var(--radius);
			background: var(--surface-raised);
			border: 1px solid var(--border);
		}

		[role='tab'] {
			flex: 1;
			font: inherit;
			font-size: 13px;
			font-weight: 600;
			padding: 8px;
			border: 0;
			border-radius: 8px;
			background: transparent;
			color: var(--text-muted);
			cursor: pointer;
		}

		[role='tab'][aria-selected='true'] {
			background: var(--tab-selected);
			color: var(--text);
			box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
		}

		.workspace {
			display: block;
		}

		.panel {
			height: calc(100dvh - 190px);
			min-height: 360px;
		}

		.panel[data-active='false'] {
			display: none;
		}
	}
</style>
