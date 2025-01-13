<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { passwordStrength } from 'check-password-strength';
	import type { ActionData } from './$types';
	import Password from '$lib/components/forms/Password.svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';

	let { form }: { form?: ActionData } = $props();

	let password = $state('');
	let confirmPassword = $state('');
	let passwordResult: {
		id: number;
		value: 'Too Weak' | 'Weak' | 'Medium' | 'Strong';
		contains: ('lowercase' | 'uppercase' | 'symbol' | 'number')[];
		length: number;
	} = $state({
		id: 0,
		value: 'Too Weak',
		contains: [],
		length: 0
	});

	$effect(() => {
		passwordResult = passwordStrength(password);
	});

	if (form?.redirect && browser) {
		goto(form.redirect);
	}
</script>

<main>
	<div class="container pt-5">
		<div class="row">
			<h1>
				{env.PUBLIC_APP_NAME}: Sign Up
			</h1>
		</div>
		<div class="row mb-3">
			<a href="/account/sign-in" class="link-primary">Sign In</a>
		</div>
		<div class="row mb-3">
			<form action="?/register" method="post">
				{#if form?.message}
					{#if form.message === 'Account created'}
						<p class="text-success">Account created successfully</p>
					{:else}
						<p class="text-danger">{form.message}</p>
					{/if}
				{/if}
				<div class="container">
					<div class="row">
						<div class="col-md-6">
							<div class="mb-3 form-floating">
								<input
									id="username"
									name="username"
									class="form-control"
									placeholder="Username"
									type="text"
								/>
								<label class="form-label" for="username"> Username </label>
							</div>
						</div>
						<div class="col-md-6">
							<div class="mb-3 form-floating">
								<input
									id="email"
									name="email"
									class="form-control"
									placeholder="Email"
									type="email"
								/>
								<label class="form-label" for="email"> Email </label>
							</div>
						</div>
					</div>
					<div class="row">
						<div class="col-md-6">
							<div class="mb-3 form-floating">
								<input
									id="firstName"
									name="firstName"
									class="form-control"
									placeholder="First Name"
									type="text"
								/>
								<label class="form-label" for="firstName"> First Name </label>
							</div>
						</div>
						<div class="col-md-6">
							<div class="mb-3 form-floating">
								<input
									id="lastName"
									name="lastName"
									class="form-control"
									placeholder="Last Name"
									type="text"
								/>
								<label class="form-label" for="lastName"> Last Name </label>
							</div>
						</div>
					</div>
					<div class="row">
						<div class="col-md-6">
							<Password
								name="password"
								placeholder=""
								bind:value={password}
								floatingLabel={true}
								label="Password"
								buttonColor="primary"
							/>
						</div>
						<div class="col-md-6">
							<Password
								name="confirmPassword"
								placeholder=""
								bind:value={confirmPassword}
								floatingLabel={true}
								label="Confirm Password"
								buttonColor="primary"
							/>
						</div>
					</div>
					<div class="row">
						<div class="col-12">
							{#if passwordResult.value === 'Too Weak'}
								<p class="text-danger">Password is too weak</p>
							{:else if passwordResult.value === 'Weak'}
								<p class="text-warning">Password is weak</p>
							{:else if passwordResult.value === 'Medium'}
								<p class="text-info">Password is medium</p>
							{:else if passwordResult.value === 'Strong'}
								<p class="text-success">Password is strong</p>
							{/if}
							<div
								class="progress"
								role="progressbar"
								aria-label="Basic example"
								aria-valuenow={passwordResult.id}
								aria-valuemin="0"
								aria-valuemax="3"
								style="height: 1px;"
							>
								<div class="progress-bar w-{(passwordResult.id * 100) / 3}"></div>
							</div>
							{#if !passwordResult.contains.includes('lowercase')}
								<p class="text-danger">Password must contain a lowercase letter</p>
							{/if}
							{#if !passwordResult.contains.includes('uppercase')}
								<p class="text-danger">Password must contain an uppercase letter</p>
							{/if}
							{#if !passwordResult.contains.includes('symbol')}
								<p class="text-danger">Password must contain a symbol</p>
							{/if}
							{#if !passwordResult.contains.includes('number')}
								<p class="text-danger">Password must contain a number</p>
							{/if}
							{#if passwordResult.length < 8}
								<p class="text-danger">Password must be at least 8 characters long</p>
							{/if}
							{#if confirmPassword !== password}
								<p class="text-danger">Passwords do not match</p>
							{/if}
						</div>
					</div>
				</div>

				<button type="submit" class="btn btn-primary"> Sign Up </button>
			</form>
		</div>
	</div>
</main>
