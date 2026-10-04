<script lang="ts">
	import { basicSetup } from 'codemirror';
	import { EditorState } from '@codemirror/state';
	import { EditorView, keymap, ViewUpdate } from '@codemirror/view';
	import { defaultKeymap } from '@codemirror/commands';
	import { svelte } from '@replit/codemirror-lang-svelte';
	import { onMount } from 'svelte';

	let {
		code = $bindable(),
		editable,
		label
	}: { code: string; editable: boolean; label: string } = $props();

	let container: HTMLDivElement;
	let editorView: EditorView | undefined = $state();

	// Colours come from the page's CSS custom properties so the editor follows
	// the light / dark theme without a separate CodeMirror theme package.
	const theme = EditorView.theme({
		'&': {
			height: '100%',
			fontSize: 'var(--code-size)',
			color: 'var(--text)',
			backgroundColor: 'var(--surface)'
		},
		'&.cm-focused': { outline: 'none' },
		'.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
		'.cm-content': { caretColor: 'var(--accent)', padding: '12px 0' },
		'.cm-cursor': { borderLeftColor: 'var(--accent)' },
		'.cm-gutters': {
			backgroundColor: 'var(--surface)',
			color: 'var(--text-faint)',
			border: 'none',
			paddingLeft: '4px'
		},
		'.cm-activeLine': { backgroundColor: 'var(--active-line)' },
		'.cm-activeLineGutter': { backgroundColor: 'var(--active-line)', color: 'var(--text-muted)' },
		'&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
			backgroundColor: 'var(--selection)'
		},
		'.cm-foldPlaceholder': {
			backgroundColor: 'var(--surface-raised)',
			border: '1px solid var(--border)',
			color: 'var(--text-muted)'
		}
	});

	function onChange(update: ViewUpdate) {
		if (update.docChanged) {
			code = update.state.doc.toString();
		}
	}

	onMount(() => {
		editorView = new EditorView({
			state: EditorState.create({
				doc: code,
				extensions: [
					keymap.of(defaultKeymap),
					basicSetup,
					svelte(),
					theme,
					EditorView.updateListener.of(onChange),
					EditorView.editable.of(editable),
					EditorState.readOnly.of(!editable),
					EditorView.contentAttributes.of({ 'aria-label': label })
				]
			}),
			parent: container
		});
		return () => editorView?.destroy();
	});

	// Read-only editors mirror `code` whenever the parent recomputes it.
	$effect(() => {
		const next = code;
		if (editable || !editorView || editorView.state.doc.toString() === next) return;
		editorView.dispatch({ changes: { from: 0, to: editorView.state.doc.length, insert: next } });
	});
</script>

<div bind:this={container} class="editor"></div>

<style>
	.editor {
		height: 100%;
		min-height: 0;
	}

	.editor :global(.cm-editor) {
		height: 100%;
	}
</style>
