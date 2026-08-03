<script lang="ts">
	import { SupaStructData, SupaStruct } from '$lib/services/supabase/supastruct.svelte';
	import Grid from '$lib/components/general/Grid.svelte';
	import { CheckboxEditorModule } from 'ag-grid-community';
	import { TooltipModule } from 'ag-grid-community';

	interface Props {
		accounts: SupaStructData<'core', 'profile'>[];
		role_accounts: SupaStructData<'core', 'role_account'>[];
		roles: SupaStructData<'core', 'role'>[];
		RoleAccount: SupaStruct<'core', 'role_account'>;
	}

	const { accounts, role_accounts, roles, RoleAccount }: Props = $props();

	const admin = $derived(roles.find((r) => r.raw.name === 'Admin'));

	type AccountProxy = {
		account: SupaStructData<'core', 'profile'>;
		admin: SupaStructData<'core', 'role_account'> | undefined;
		is_admin: boolean;
	};

	const account_proxy: AccountProxy[] = $derived(
		accounts.map((account) => {
			const is_admin = role_accounts.find(
				(ra) => ra.raw.account === account.raw.id && ra.raw.role === admin?.raw.id
			);
			return {
				account,
				is_admin: !!is_admin,
				admin: is_admin,
			};
		})
	);
</script>

<Grid
	data={account_proxy}
	opts={{
		columnDefs: [
			{
				field: 'account.raw.username',
				headerName: 'Username',
				width: 100
			},
			{
				field: 'account.raw.email',
				headerName: 'Email'
			},
			{
				field: 'account.raw.first_name',
				headerName: 'First Name',
				width: 100
			},
			{
				field: 'account.raw.last_name',
				headerName: 'Last Name',
				width: 100
			},
			{
                headerName: 'Admin',
                editable: true,
                cellEditor: 'agCheckboxCellEditor',
                cellDataType: 'boolean',
                valueGetter: (params) => !!params.data?.admin,
                valueSetter: (params) => {
                    if (!params.data) return false;
                    return params.newValue;
                },
                onCellValueChanged: async (params) => {
                    if (!params.data) return;
                    console.log(params);
                    const account = params.data.account;

                    if (params.data.admin) {
                        // Remove admin role
                        await params.data.admin.delete();
                    } else {
                        // Add admin role
                        await RoleAccount.new({
                            account: account.raw.id,
                            role: admin?.raw.id,
                        });
                    }
                }
			},
			// {
			// 	field: 'mentor',
			// 	headerName: 'Mentor',
			// 	width: 80,
			// 	editable: true,
			// 	cellEditor: 'agCheckboxCellEditor',
			// 	cellDataType: 'boolean',
			// 	valueGetter: (params) => !!params.data?.mentor,
			// 	valueSetter: (params) => {
			// 		if (!params.data) return false;
			// 		const next = params.newValue === true || params.newValue === 'true';
			// 		const prev = !!params.data.mentor;
			// 		return next !== prev;
			// 	},
			// 	onCellValueChanged: async (params) => {
			// 		if (!params.data) return;
			// 		console.log(params);
			// 		const account = params.data.account;
			// 		const isChecked = params.newValue === true || params.newValue === 'true';

			// 		if (isChecked) {
			// 			await params.data.mentor?.delete();
			// 		} else {
			// 			await RoleAccount.new({
			// 				account: account.raw.id,
			// 				role: mentor?.raw.id
			// 			});
			// 		}
			// 	}
			// },
			// {
			// 	field: 'student',
			// 	headerName: 'Student',
			// 	width: 80,
			// 	editable: true,
			// 	cellEditor: 'agCheckboxCellEditor',
			// 	cellDataType: 'boolean',
			// 	valueGetter: (params) => !!params.data?.student,
			// 	valueSetter: (params) => {
			// 		if (!params.data) return false;
			// 		const next = params.newValue === true || params.newValue === 'true';
			// 		const prev = !!params.data.student;
			// 		return next !== prev;
			// 	},
			// 	onCellValueChanged: async (params) => {
			// 		if (!params.data) return;
			// 		const account = params.data.account;
			// 		const isChecked = params.newValue === true || params.newValue === 'true';

			// 		if (isChecked) {
			// 			await params.data.student?.delete();
			// 		} else {
			// 			await RoleAccount.new({
			// 				account: account.raw.id,
			// 				role: student?.raw.id
			// 			});
			// 			const is_viewer = params.data.viewer;
			// 			if (!is_viewer) {
			// 				await RoleAccount.new({
			// 					account: account.raw.id,
			// 					role: viewer?.raw.id
			// 				});
			// 			}
			// 		}
			// 	}
			// },
			// {
			// 	field: 'viewer',
			// 	headerName: 'Viewer',
			// 	width: 80,
			// 	editable: true,
			// 	cellEditor: 'agCheckboxCellEditor',
			// 	cellDataType: 'boolean',
			// 	valueGetter: (params) => !!params.data?.viewer,
			// 	valueSetter: (params) => {
			// 		if (!params.data) return false;
			// 		const next = params.newValue === true || params.newValue === 'true';
			// 		const prev = !!params.data.viewer;
			// 		return next !== prev;
			// 	},
			// 	onCellValueChanged: async (params) => {
			// 		if (!params.data) return;
			// 		const account = params.data.account;
			// 		const isChecked = params.newValue === true || params.newValue === 'true';

			// 		if (isChecked) {
			// 			await params.data.viewer?.delete();
			// 			const is_student = params.data.student;
			// 			if (is_student) {
			// 				await params.data.student?.delete();
			// 			}
			// 		} else {
			// 			await RoleAccount.new({
			// 				account: account.raw.id,
			// 				role: viewer?.raw.id
			// 			});
			// 		}
			// 	},
			// 	cellStyle: (params) => {
			// 		// if is student and not a viewer, make the cell yellow
			// 		if (params.data?.student && !params.data?.viewer) {
			// 			return { backgroundColor: pallette.warning.setAlpha(0.5).toString('rgba') };
			// 		}
			// 	},
			// 	tooltipValueGetter: (params) => {
			// 		if (params.data?.student && !params.data?.viewer) {
			// 			return 'Student accounts should also be viewers.';
			// 		}
			// 		return '';
			// 	}
			// }
		],
		tooltipShowDelay: 0
	}}
	height="400px"
	modules={[CheckboxEditorModule, TooltipModule]}
/>
