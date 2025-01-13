export type Notification = {
	title: string;
	message: string;
	icon?: string;
	severity: 'info' | 'warning' | 'danger' | 'success';
};
