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
		maxHeight
	}: { code: string; editable: boolean; maxHeight: string } = $props();

	const randomId = Math.random().toString(36).slice(2);
	let editorView: EditorView;

	function onChange(update: ViewUpdate) {
		if (update.docChanged) {
			const newContent = update.state.doc.toString();
			code = newContent;
		}
	}

	onMount(() => {
		const startState = EditorState.create({
			doc: code,
			extensions: [
				keymap.of(defaultKeymap),
				basicSetup,
				svelte(),
				EditorView.updateListener.of(onChange),
				EditorView.editable.of(editable)
			]
		});

		editorView = new EditorView({
			state: startState,
			parent: document.getElementById(randomId)!
		});

		if (!editable) {
			$effect(() => {
				editorView?.dispatch({
					changes: { from: 0, to: editorView.state.doc.length, insert: code }
				});
			});
		}
	});
</script>

<div id={randomId} class="editor" style:max-height={maxHeight}></div>

<style>
	.editor {
		min-height: 200px;
		overflow: auto;
	}
</style>
