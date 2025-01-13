<script lang="ts">
	import { env } from '$env/dynamic/public';
	import type { ActionData } from './$types';
	import Password from '$lib/components/forms/Password.svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	// const validateEmail = (value: string) => {
	//     if (!value) return '';
	//     const [email, domain] = value.split('@');
	//     if (!email || !domain) return 'Invalid email address';
	//     if (!domain.includes('.')) return 'Invalid email address';
	//     const [domainName, ext] = domain.split('.');
	//     if (!domainName) return 'Invalid domain name';
	//     if (!ext) return 'Invalid extension';
	//     return '';
	// };

	let { form }: { form?: ActionData } = $props();

	// let user = $state(form?.user || '');

	if (form?.redirect && browser) {
		goto(form.redirect);
	}
</script>

<main>
	<div class="container pt-5">
		<div class="row">
			<h1>
				{env.PUBLIC_APP_NAME}: Sign In
			</h1>
		</div>
		<div class="row mb-3">
			<a href="/account/sign-up" class="link-primary">Sign Up</a>
		</div>
		<div class="row mb-3">
			<form action="?/login" method="post">
				<div class="mb-3 form-floating">
					<input
						id="user"
						name="user"
						class="form-control"
						placeholder="Username or Email"
						type="text"
						value={form?.user ?? ''}
					/>
					<label class="form-label" for="user"> Username or Email </label>
				</div>
				<div class="mb-3 form-floating">
					<Password
						name="password"
						placeholder=""
						floatingLabel={true}
						label="Password"
						buttonColor="primary"
					/>
				</div>

				<a href="/account/password-reset" class="link-primary"> Password Reset </a>

				<hr />
				{#if form?.message}
					{#if form.message === 'Logged in'}
						<p class="text-success">Logged in successfully</p>
					{:else}
						<p class="text-danger">
							{form.message}
						</p>
					{/if}
				{/if}
				<button type="submit" class="btn btn-primary"> Sign In </button>
			</form>
		</div>
	</div>
</main>
