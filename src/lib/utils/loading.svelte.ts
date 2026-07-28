export const loading_state: {
	message: string;
	state: 'idle' | 'loading' | 'fading';
} = $state({
	message: '',
	state: 'idle'
});

let timeout: ReturnType<typeof setTimeout>;

export const done = () => {
	loading_state.state = 'fading';
	if (timeout) clearTimeout(timeout);
	timeout = setTimeout(() => {
		loading_state.state = 'idle';
		loading_state.message = '';
	}, 300);
};

export const loading = (message: string) => {
	loading_state.message = message;
	loading_state.state = 'loading';
	return done;
};
