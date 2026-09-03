<script lang="ts">
	let {
		open = $bindable(true),
		onClose = async () => {}
	}: {
		open?: boolean;
		onClose?: () => Promise<void> | void;
	} = $props();

	async function handleStart() {
		open = false;
		await onClose?.();
	}
</script>

{#if open}
	<div class="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
		<div class="welcome-dialog">
			<h1 id="welcome-title" class="welcome-title">The Sine Quartet</h1>
			<p class="credit-line">
				Made for exploration of string harmony by
				<a href="https://sharpestnote.com" target="_blank" rel="noreferrer"
					>Pekka Pulli from The Sharpest Note</a
				>
				in conversation with Vitor Vieira.
			</p>
			<button type="button" class="welcome-button" onclick={handleStart}> Enter the Studio </button>
		</div>
	</div>
{/if}

<style>
	.welcome-overlay {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1.5rem;
		background: rgba(2, 6, 23, 0.72);
		backdrop-filter: blur(8px);
		z-index: 30;
	}

	.welcome-dialog {
		display: grid;
		gap: 1rem;
		max-width: min(32rem, 92vw);
		padding: 1.75rem 1.5rem 1.5rem;
		border: 1px solid rgba(125, 211, 252, 0.42);
		border-radius: 1.25rem;
		background: rgba(15, 23, 42, 0.92);
		box-shadow: 0 30px 60px rgba(15, 23, 42, 0.5);
		text-align: center;
	}

	.welcome-button {
		justify-self: center;
		padding: 0.8rem 1.3rem;
		border: 1px solid rgba(125, 211, 252, 0.5);
		border-radius: 999px;
		background: linear-gradient(135deg, rgba(14, 165, 233, 0.28), rgba(168, 85, 247, 0.2));
		color: #f0f9ff;
		font-size: 0.95rem;
		font-weight: 700;
		cursor: pointer;
	}

	.welcome-title {
		margin: 0;
		font-size: clamp(2.2rem, 5vw, 3.5rem);
		line-height: 1;
		letter-spacing: -0.06em;
		font-weight: 800;
		color: #f8fbff;
	}

	.credit-line {
		margin: 0;
		font-size: 1rem;
		line-height: 1.4;
		color: rgba(191, 219, 254, 0.8);
	}

	.credit-line a {
		color: #7dd3fc;
		text-decoration: none;
	}

	.credit-line a:hover {
		text-decoration: underline;
	}
</style>
