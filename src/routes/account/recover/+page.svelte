<script lang="ts">
    import { onMount } from 'svelte';
    import Password from '$lib/components/forms/Password.svelte';
	import { passwordStrength } from 'check-password-strength';
    import { alert } from '$lib/utils/prompts.js';

    const { data } = $props();

    let password = $state('');
    let confirmPassword = $state('');
	const passwordResult = $derived(passwordStrength(password));

    onMount(async () => {
        const hash = window.location.hash;

        const params = new URLSearchParams(hash.replace('#', ''));

        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (!access_token || !refresh_token) {
            return console.error('No access token or refresh token found in URL');
        }

        await data.supabase.auth.setSession({
            access_token,
            refresh_token
        });
    });

    const resetPassword = async () => {
        if (password !== confirmPassword) return alert('Passwords do not match');
        if (passwordResult.value !== 'Strong') return alert('Password is not strong enough');
        if (passwordResult.contains.length < 4) return alert('Password must contain a lowercase letter, an uppercase letter, a symbol, and a number');
        if (passwordResult.length < 8) return alert('Password must be at least 8 characters long');

        const { error } = await data.supabase.auth.updateUser({
            password
        });

        if (error) {
            alert('There was an error resetting your password. Please try again later.');
            return console.error(error);
        } else {
            alert('Your password has been reset successfully. Please sign in with your new password.');
            setTimeout(() => {
                window.location.href = '/account/sign-in';
            }, 3000);
        }
    }; 
</script>

<div class="container layer-1 py-5 mt-5">
    <div class="row">
        <h1>
            {__APP_ENV__.name}: Account Recovery
        </h1>
    </div>
    <div class="row mb-3">
        <Password
            bind:value={password}
            name="password"
            placeholder="New Password"
            label="New Password"
            floatingLabel
        />
    </div>
    <div class="row mb-3">
        <Password
            bind:value={confirmPassword}
            name="confirmPassword"
            placeholder="Confirm New Password"
            label="Confirm New Password"
            floatingLabel
        />
    </div>
					<div class="row mb-3">
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
                    <div class="d-flex">
                        <button 
                        class="btn btn-primary" 
                        id="resetPasswordButton"
                         onclick={resetPassword}
                         disabled={
                            passwordResult.value === 'Too Weak' ||
                            passwordResult.value === 'Weak' ||
                            confirmPassword !== password ||
                            passwordResult.contains.length < 4 ||
                            passwordResult.length < 8
                         }
                         > Reset Password </button>
                    </div>
</div>