<script lang="ts">
	import { goto } from '$app/navigation';
	import Card from '$lib/components/bootstrap/Card.svelte';
	import { Account } from '$lib/model/account';
	import { Universes } from '$lib/model/universe';

	const { max, ceil, min } = Math;

	const { data } = $props();
	const universes = data.universes;
	const publicUniverses = data.publicUniverses;
	const current = data.current;
	const invites = data.invites;

	const self = Account.getSelf();

	const universePage = data.universePage;
	const invitePage = data.invitePage;
	const universeOffset = data.universeNumber;
	const inviteOffset = data.inviteNumber;
	const universeCount = data.universeCount;
	const inviteCount = data.inviteCount;

	// TODO: Implement pagination
</script>

<div class="container">
	<div class="row mb-3">
		<div class="col-12">
			<h1>Universes</h1>
		</div>
	</div>
	<div class="row mb-3">
		<div class="col-md-6 mb-5">
			<Card title="My Invites" glowColor="secondary">
				{#snippet body()}
					{#if invites.length > 0}
						<ul class="list-group">
							{#each invites as invite}
								<li class="list-group-item">
									<div class="d-flex justify-content-between">
										<div>
											<h5 class="mb-1">{invite.universe.data.name}</h5>
											<p class="mb-1">{invite.universe.data.description}</p>
										</div>
										<div>
											<a href="/universe/invite/{invite.invite.data.id}">
												<button class="btn btn-primary">View</button>
											</a>
										</div>
									</div>
								</li>
							{/each}
						</ul>
					{:else}
						<p>No invites</p>
					{/if}
				{/snippet}
			</Card>
		</div>
		<div class="col-md-6 mb-5">
			<Card title="My Universes" glowColor="primary">
				{#snippet body()}
					{#if universes.length}
						<!-- <nav>
                            <ul class="pagination">
                                <li class="page-item">
                                    <a class="page-link" href="/universe/?universePage=1">
                                        <span aria-hidden="true">«</span>
                                    </a>
                                </li>
                                {#if universePage > 1}
                                    <li class="page-item">
                                        <a class="page-link" href="/universe/?universePage={universePage - 1}">
                                            <span aria-hidden="true">‹</span>
                                        </a>
                                    </li>
                                {/if}
                                {#if universeCount > 1}
                                    {#each Array.from({ length: min(5, universeCount) }).map((_, i) => i + max(1, universePage - 2))}
                                        <li class="page-item">
                                            <a class="page-link" href="/universe/?universePage=">
                                            </a>
                                        </li>
                                    {/each}
                                {/if}
                                {#if universePage < universeCount}
                                    <li class="page-item">
                                        <a class="page-link" href="/universe/?universePage={universePage + 1}">
                                            <span aria-hidden="true">›</span>
                                        </a>
                                    </li>
                                {/if}
                            </ul>
                        </nav> -->
						<ul class="list-group">
							{#each universes as universe}
								<li class="list-group-item">
									<div class="d-flex justify-content-between">
										<div>
											<h5 class="mb-1">{universe.data.name}</h5>
											<p class="mb-1">{universe.data.description}</p>
										</div>
										<div>
											<a href="/universe/{universe.data.id}">
												<button class="btn btn-primary">View</button>
											</a>
										</div>
									</div>
								</li>
							{/each}
						</ul>
					{:else}
						<p>No universes</p>
					{/if}
				{/snippet}
			</Card>
		</div>
		<div class="col-md-6 mb-5">
			<Card title="Public Universes" glowColor="success">
				{#snippet body()}
					{#if publicUniverses.length}
						<ul class="list-group">
							{#each publicUniverses as universe}
								<li class="list-group-item">
									<div class="d-flex justify-content-between">
										<div>
											<h5 class="mb-1">{universe.data.name}</h5>
											<p class="mb-1">{universe.data.description}</p>
										</div>
										<div>
											<a href="/universe/{universe.data.id}">
												<button class="btn btn-primary">View</button>
											</a>
										</div>
									</div>
								</li>
							{/each}
						</ul>
					{:else}
						<p>No public universes</p>
					{/if}
				{/snippet}
			</Card>
		</div>
		<div class="col-md-6 mb-5">
			<Card title="Create Universe" glowColor="info">
				{#snippet body()}{/snippet}
			</Card>
		</div>
		<div class="col-md-6 mb-5">
			<Card title="Current Universe" glowColor="warning">
				{#snippet body()}
					{#if $current}
						<div class="d-flex justify-content-between">
							<div>
								<h5 class="mb-1">{$current.name}</h5>
								<p class="mb-1">{$current.description}</p>
							</div>
							<div>
								<a href="/universe/{$current.id}">
									<button class="btn btn-primary">View</button>
								</a>
							</div>
						</div>
					{:else}
						<p>No current universe</p>
					{/if}
				{/snippet}
			</Card>
		</div>
	</div>
</div>
