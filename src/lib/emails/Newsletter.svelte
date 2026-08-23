<!-- src/emails/welcome.svelte -->
<script lang="ts">
	import {
		Html,
		Head,
		Preview,
		Body,
		Container,
		Heading,
		Text,
		Button
	} from '@svelte-plugin/email';

	let { first_name = 'there', last_name = '' }: { first_name?: string; last_name?: string } =
		$props();
</script>

<Html lang="en">
	<Head />
	<Body class="dark:bg-slate-100 font-sans">
		<Preview children="Welcome to Acme — let's get you set up." />
		<Container class="dark:bg-white rounded-2xl p-8">
			<Heading as="h1" class="text-2xl font-bold dark:text-slate-900"
				>Welcome, {first_name} {last_name}!</Heading
			>
			<Text class="dark:text-slate-600">Thank you for joining our newsletter.</Text>
			<Button href="https://example.com/start" class="bg-blue-600 text-white rounded-lg px-6 py-3">
				Get started!
			</Button>
		</Container>
	</Body>
</Html>
