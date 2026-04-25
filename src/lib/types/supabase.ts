export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	public: {
		Tables: {
			[_ in never]: never;
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	test_schema: {
		Tables: {
			account_notification: {
				Row: {
					account_id: string | null;
					archived: boolean;
					created_at: string;
					icon: string;
					icon_type: string;
					id: string;
					link: string | null;
					message: string;
					read: boolean;
					severity: string;
					title: string;
				};
				Insert: {
					account_id?: string | null;
					archived?: boolean;
					created_at?: string;
					icon: string;
					icon_type: string;
					id?: string;
					link?: string | null;
					message: string;
					read?: boolean;
					severity: string;
					title: string;
				};
				Update: {
					account_id?: string | null;
					archived?: boolean;
					created_at?: string;
					icon?: string;
					icon_type?: string;
					id?: string;
					link?: string | null;
					message?: string;
					read?: boolean;
					severity?: string;
					title?: string;
				};
				Relationships: [];
			};
			admin: {
				Row: {
					archived: boolean;
					created_at: string;
					id: string;
				};
				Insert: {
					archived?: boolean;
					created_at?: string;
					id?: string;
				};
				Update: {
					archived?: boolean;
					created_at?: string;
					id?: string;
				};
				Relationships: [];
			};
			profile: {
				Row: {
					archived: boolean;
					created_at: string;
					email: string;
					first_name: string;
					id: string;
					last_name: string;
					username: string;
				};
				Insert: {
					archived?: boolean;
					created_at?: string;
					email: string;
					first_name: string;
					id: string;
					last_name: string;
					username: string;
				};
				Update: {
					archived?: boolean;
					created_at?: string;
					email?: string;
					first_name?: string;
					id?: string;
					last_name?: string;
					username?: string;
				};
				Relationships: [];
			};
			role: {
				Row: {
					archived: boolean;
					color: string;
					created_at: string;
					description: string;
					id: string;
					name: string;
				};
				Insert: {
					archived?: boolean;
					color: string;
					created_at?: string;
					description: string;
					id?: string;
					name: string;
				};
				Update: {
					archived?: boolean;
					color?: string;
					created_at?: string;
					description?: string;
					id?: string;
					name?: string;
				};
				Relationships: [];
			};
			role_account: {
				Row: {
					account: string | null;
					archived: boolean;
					created_at: string;
					id: string;
					role: string | null;
				};
				Insert: {
					account?: string | null;
					archived?: boolean;
					created_at?: string;
					id?: string;
					role?: string | null;
				};
				Update: {
					account?: string | null;
					archived?: boolean;
					created_at?: string;
					id?: string;
					role?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'role_account_role_fkey';
						columns: ['role'];
						isOneToOne: false;
						referencedRelation: 'role';
						referencedColumns: ['id'];
					}
				];
			};
			session: {
				Row: {
					account_id: string | null;
					archived: boolean;
					created_at: string;
					id: string;
					prev_url: string | null;
				};
				Insert: {
					account_id?: string | null;
					archived?: boolean;
					created_at?: string;
					id?: string;
					prev_url?: string | null;
				};
				Update: {
					account_id?: string | null;
					archived?: boolean;
					created_at?: string;
					id?: string;
					prev_url?: string | null;
				};
				Relationships: [];
			};
			test: {
				Row: {
					age: number;
					archive: boolean;
					archived: boolean;
					created_at: string;
					id: string;
					name: string;
				};
				Insert: {
					age: number;
					archive?: boolean;
					archived?: boolean;
					created_at?: string;
					id?: string;
					name: string;
				};
				Update: {
					age?: number;
					archive?: boolean;
					archived?: boolean;
					created_at?: string;
					id?: string;
					name?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		| keyof DefaultSchema['Enums']
		| { schema: keyof DatabaseWithoutInternals },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never = never
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema['CompositeTypes']
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never = never
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	public: {
		Enums: {}
	},
	test_schema: {
		Enums: {}
	}
} as const;
