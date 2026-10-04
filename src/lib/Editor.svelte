<script lang="ts">
	import { basicSetup } from 'codemirror';
	import { EditorState } from '@codemirror/state';
	import { EditorView, keymap, ViewUpdate } from '@codemirror/view';
	import { defaultKeymap } from '@codemirror/commands';
	import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
	import { tags } from '@lezer/highlight';
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

	// basicSetup's default highlight style is tuned for light backgrounds only.
	// Token colours come from CSS custom properties instead, so both themes can
	// keep every token at WCAG AA contrast.
	const highlight = HighlightStyle.define([
		{
			tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword],
			color: 'var(--tok-keyword)'
		},
		{ tag: [tags.string, tags.special(tags.string), tags.regexp], color: 'var(--tok-string)' },
		{ tag: [tags.number, tags.bool, tags.null, tags.atom], color: 'var(--tok-constant)' },
		{ tag: [tags.propertyName, tags.attributeName], color: 'var(--tok-property)' },
		{
			tag: [tags.typeName, tags.className, tags.function(tags.variableName)],
			color: 'var(--tok-type)'
		},
		{ tag: [tags.tagName, tags.angleBracket], color: 'var(--tok-tag)' },
		{ tag: [tags.comment, tags.meta], color: 'var(--tok-comment)', fontStyle: 'italic' },
		{ tag: tags.invalid, color: 'var(--error-text)' }
	]);

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
					syntaxHighlighting(highlight),
					EditorView.updateListener.of(onChange),
					// Read-only panels stay focusable so keyboard users can scroll,
					// select and copy them; `readOnly` alone blocks edits.
					EditorState.readOnly.of(!editable),
					EditorView.contentAttributes.of(
						editable
							? { 'aria-label': label }
							: { 'aria-label': label, 'aria-readonly': 'true', inputmode: 'none' }
					)
				]
			}),
			parent: container
		});
		return () => editorView?.destroy();
	});

	// Mirror `code` when the parent changes it: recomputed output for read-only
	// editors, and "Reset example" for the input. Typing never re-enters here
	// because `onChange` has already made `code` equal to the document.
	$effect(() => {
		const next = code;
		if (!editorView || editorView.state.doc.toString() === next) return;
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
