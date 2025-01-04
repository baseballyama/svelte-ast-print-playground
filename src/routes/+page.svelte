<script lang="ts">
	import { print } from 'svelte-ast-print';
	import { parse } from 'svelte/compiler';
	import Editor from '$lib/Editor.svelte';
	import LZString from 'lz-string';

	const tag = 'script';
	const defaultSvelte = `\
<${tag} lang="ts">
  const props: { foo: string } = $props();
</${tag}>

<div>Hi!</div>`;

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

	let svelte = $state(getInitialSvelte());
	let svelteAST = $derived.by(() => {
		try {
			return parse(svelte, { modern: true });
		} catch (e) {
			console.error(e);
			return null;
		}
	});
	let output = $derived.by(() => {
		try {
			if (!svelteAST) return 'Error parsing Svelte code';
			return print(svelteAST);
		} catch (e) {
			console.error(e);
			return 'Error printing AST';
		}
	});

	$effect(() => {
		const encoded = LZString.compressToEncodedURIComponent(svelte);
		history.replaceState(null, '', `#${encoded}`);
	});
</script>

<header>
	<h1>svelte-ast-print Playground</h1>
	<div class="links">
		<a href="https://github.com/xeho91/svelte-ast-print?tab=readme-ov-file" target="_blank">
			svelte-ast-print on GitHub
		</a>
		<a href="https://github.com/baseballyama/svelte-ast-print-playground" target="_blank">
			Playground on GitHub
		</a>
	</div>
</header>

<div class="box">
	<div class="left">
		<h2>Svelte</h2>
		<Editor bind:code={svelte} editable={true} maxHeight="calc(50vh - 80px)" />

		<h2>Svelte → AST → Svelte</h2>
		<Editor code={output} editable={false} maxHeight="calc(50vh - 80px)" />
	</div>
	<div class="right">
		<h2>Svelte → AST</h2>
		<Editor
			code={JSON.stringify(svelteAST, null, 2)}
			editable={false}
			maxHeight="calc(100vh - 110px)"
		/>
	</div>
</div>

<style>
	header {
		border-bottom: 2px solid #ccc;
		margin-bottom: 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.links {
		margin-right: 16px;
		display: flex;
		gap: 1rem;
	}

	.box {
		display: flex;
		gap: 1rem;
	}

	.left {
		flex: 1;
	}

	.right {
		flex: 1;
	}
</style>
