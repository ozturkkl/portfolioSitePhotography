<script lang="ts">
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import Portrait from '$lib/components/ui/Portrait.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import PageContainer from '$lib/components/ui/PageContainer.svelte';
	import SectionHeading from '$lib/components/ui/SectionHeading.svelte';
	import { PUBLIC_WEB3FORMS_ACCESS_KEY } from '$env/static/public';
	import { media } from '$lib/data/media';
	import {
		defaultPackageId,
		isPackageSelectionId,
		pricingPackages
	} from '$lib/data/pricing';
	import { pageTitle, site } from '$lib/data/site';

	const draftKey = 'ilaydaturkmen-contact-draft';
	const limits = { name: 100, email: 254, message: 2000 } as const;
	const accessKeys = [
		...new Set(
			(PUBLIC_WEB3FORMS_ACCESS_KEY ?? '')
				.split(',')
				.map((key) => key.trim())
				.filter(Boolean)
		)
	];

	let formElement = $state<HTMLFormElement | null>(null);
	let name = $state('');
	let email = $state('');
	let message = $state('');
	let packageId = $state(defaultPackageId);
	let submitted = $state(false);
	let submitting = $state(false);
	let submitError = $state('');
	let draftReady = $state(false);

	function loadDraft() {
		if (!browser) return null;

		try {
			const raw = localStorage.getItem(draftKey);
			if (!raw) return null;

			const d = JSON.parse(raw);
			return {
				name: String(d.name ?? '').slice(0, limits.name),
				email: String(d.email ?? '').slice(0, limits.email),
				message: String(d.message ?? '').slice(0, limits.message),
				package: isPackageSelectionId(d.package) ? d.package : defaultPackageId
			};
		} catch {
			return null;
		}
	}

	function consumeUrlPackage() {
		const param = page.url.searchParams.get('package');
		if (!param || !isPackageSelectionId(param)) return null;

		const url = new URL(page.url);
		url.searchParams.delete('package');
		replaceState(`${url.pathname}${url.search}${url.hash}`, page.state);

		return param;
	}

	$effect(() => {
		if (!browser) return;

		const hasPackageParam = page.url.searchParams.has('package');

		if (!draftReady) {
			const draft = loadDraft();
			if (draft) {
				name = draft.name;
				email = draft.email;
				message = draft.message;
			}
			packageId = (hasPackageParam ? consumeUrlPackage() : null) ?? draft?.package ?? defaultPackageId;
			draftReady = true;
			return;
		}

		if (!hasPackageParam) return;

		const fromUrl = consumeUrlPackage();
		if (fromUrl) packageId = fromUrl;
	});

	$effect(() => {
		if (!browser || !draftReady || submitted) return;

		name;
		email;
		message;
		packageId;
		if (!name && !email && !message && packageId === defaultPackageId) {
			localStorage.removeItem(draftKey);
		} else {
			localStorage.setItem(draftKey, JSON.stringify({ name, email, message, package: packageId }));
		}
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitError = '';

		if (!accessKeys.length) {
			submitError = `Contact form is not configured. Please email ${site.contact.email} directly.`;
			return;
		}

		submitting = true;

		try {
			const payload = {
				name,
				email,
				message,
				package: packageId,
				botcheck: '',
				subject: `New contact - ${name} (${packageId})`,
				from_name: 'Ilayda Turkmen Photography'
			};

			await Promise.all(
				accessKeys.map(async (accessKey) => {
					const response = await fetch('https://api.web3forms.com/submit', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
						body: JSON.stringify({ ...payload, access_key: accessKey })
					});

					const result = (await response.json()) as { success?: boolean };
					if (!response.ok || !result.success) throw result;
				})
			);

			if (browser) localStorage.removeItem(draftKey);
			submitted = true;
		} catch {
			submitError = `Something went wrong sending your message. Please email ${site.contact.email} directly.`;
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>{pageTitle('Contact')}</title>
</svelte:head>

<PageContainer width="narrow">
	<SectionHeading
		title="Book your date"
		subtitle="I'd love to hear about your vision. Fill out the form below and I'll get back to you within 48 hours."
	/>

	{#if submitted}
		<div class="flex justify-center px-2 py-10 md:py-14 lg:py-20">
			<article
				class="success-card rounded-site w-full max-w-md border border-accent bg-white p-8 text-center shadow-lg shadow-accent/10 md:p-10"
				role="status"
				aria-live="polite"
			>
				<div class="success-icon mx-auto mb-6 size-20 text-accent" aria-hidden="true">
					<svg viewBox="0 0 64 64" class="size-full overflow-visible">
						<circle
							class="success-circle"
							cx="32"
							cy="32"
							r="28"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						/>
						<path
							class="success-mark"
							d="M22 33.5 29.5 41 42.5 26"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</div>

				<h2 class="success-copy success-copy--1 heading-card">Thank you for reaching out!</h2>
				<p class="success-copy success-copy--2 text-body-muted mt-4">
					I'll be in touch within 48 hours. In the meantime, feel free to follow along on
					Instagram.
				</p>

				<div class="success-copy success-copy--3 mt-8 border-t border-cream-dark pt-8">
					<p class="text-caption">Instagram</p>
					<a
						href={site.contact.instagramUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="text-contact text-2xl md:text-3xl"
					>
						{site.contact.instagram}
					</a>
				</div>
			</article>
		</div>
	{:else}
		<div class="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12 xl:gap-16">
			<form class="min-w-0 flex-1 space-y-6" bind:this={formElement} onsubmit={handleSubmit}>
				<input
					type="checkbox"
					name="botcheck"
					class="hidden"
					tabindex="-1"
					autocomplete="off"
					aria-hidden="true"
				/>

				<div>
					<label for="name" class="label">Name</label>
					<input
						id="name"
						name="name"
						type="text"
						bind:value={name}
						required
						maxlength={limits.name}
						class="input"
					/>
				</div>

				<div>
					<label for="email" class="label">Email</label>
					<input
						id="email"
						name="email"
						type="email"
						bind:value={email}
						required
						maxlength={limits.email}
						class="input"
					/>
				</div>

				<fieldset>
					<legend class="label">Session type</legend>
					<div class="flex flex-wrap gap-2">
						{#each pricingPackages as pkg (pkg.id)}
							<label class="radio-option">
								<input
									type="radio"
									name="package"
									value={pkg.id}
									bind:group={packageId}
									class="radio-input"
								/>
								<span class="text-sm">{pkg.id === 'custom' ? 'Custom / other' : pkg.name}</span>
							</label>
						{/each}
					</div>
				</fieldset>

				<div>
					<div class="mb-2 flex items-baseline justify-between gap-4">
						<label for="message" class="label mb-0">Message</label>
						<p class="text-caption tabular-nums" aria-live="polite">
							{message.length}/{limits.message}
						</p>
					</div>
					<textarea
						id="message"
						name="message"
						bind:value={message}
						required
						maxlength={limits.message}
						rows={8}
						class="input min-h-52 resize-y"
						placeholder="Tell me about your session, preferred dates, and any ideas you have in mind..."
						onkeydown={(event) => {
							if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
							event.preventDefault();
							if (!submitting) formElement?.requestSubmit();
						}}
					></textarea>
				</div>

				{#if submitError}
					<p class="text-sm text-red-700" role="alert">{submitError}</p>
				{/if}

				<Button type="submit" block disabled={submitting}>
					{submitting ? 'Sending…' : 'Send message'}
				</Button>
			</form>

			<aside class="flex shrink-0 flex-col items-center gap-8 text-center lg:items-start lg:text-left">
				<div>
					<p class="text-caption">Email</p>
					<a href="mailto:{site.contact.email}" class="text-contact">
						{site.contact.email}
					</a>
				</div>

				<div>
					<p class="text-caption">Instagram</p>
					<a
						href={site.contact.instagramUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="text-contact"
					>
						{site.contact.instagram}
					</a>
				</div>

				<div class="flex w-full justify-center">
					<Portrait asset={media.contact} />
				</div>
			</aside>
		</div>
	{/if}
</PageContainer>

<style>
	.success-card {
		animation: success-in 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.success-circle {
		stroke-dasharray: 176;
		stroke-dashoffset: 176;
		animation: success-draw 0.75s cubic-bezier(0.22, 1, 0.36, 1) 0.2s forwards;
	}

	.success-mark {
		stroke-dasharray: 34;
		stroke-dashoffset: 34;
		animation: success-draw 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.75s forwards;
	}

	.success-copy {
		animation: success-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.success-copy--1 {
		animation-delay: 0.55s;
	}

	.success-copy--2 {
		animation-delay: 0.68s;
	}

	.success-copy--3 {
		animation-delay: 0.81s;
	}

	@keyframes success-in {
		from {
			opacity: 0;
			transform: translateY(12px);
		}

		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes success-draw {
		to {
			stroke-dashoffset: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.success-card,
		.success-circle,
		.success-mark,
		.success-copy {
			animation: none;
		}

		.success-circle,
		.success-mark {
			stroke-dashoffset: 0;
		}
	}
</style>
