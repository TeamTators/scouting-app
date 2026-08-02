export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  core: {
    Tables: {
      account_notification: {
        Row: {
          account_id: string
          archived: boolean
          created_at: string
          icon: string
          icon_type: string
          id: string
          link: string | null
          message: string
          read: boolean
          severity: string
          title: string
        }
        Insert: {
          account_id: string
          archived?: boolean
          created_at?: string
          icon: string
          icon_type: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          severity: string
          title: string
        }
        Update: {
          account_id?: string
          archived?: boolean
          created_at?: string
          icon?: string
          icon_type?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          severity?: string
          title?: string
        }
        Relationships: []
      }
      admin: {
        Row: {
          archived: boolean
          created_at: string
          id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      cached_request: {
        Row: {
          archived: boolean
          created_at: string
          headers: string
          id: string
          response: string
          status: number
          ttl: number
          url: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          headers: string
          id?: string
          response: string
          status: number
          ttl: number
          url: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          headers?: string
          id?: string
          response?: string
          status?: number
          ttl?: number
          url?: string
        }
        Relationships: []
      }
      profile: {
        Row: {
          archived: boolean
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          username: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          email: string
          first_name: string
          id: string
          last_name: string
          username: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          username?: string
        }
        Relationships: []
      }
      role: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          description: string
          id: string
          name: string
        }
        Insert: {
          archived?: boolean
          color: string
          created_at?: string
          description: string
          id?: string
          name: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      role_account: {
        Row: {
          account: string | null
          archived: boolean
          created_at: string
          id: string
          role: string | null
        }
        Insert: {
          account?: string | null
          archived?: boolean
          created_at?: string
          id?: string
          role?: string | null
        }
        Update: {
          account?: string | null
          archived?: boolean
          created_at?: string
          id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_account_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "role"
            referencedColumns: ["id"]
          },
        ]
      }
      session: {
        Row: {
          account_id: string | null
          archived: boolean
          created_at: string
          id: string
          prev_url: string | null
        }
        Insert: {
          account_id?: string | null
          archived?: boolean
          created_at?: string
          id?: string
          prev_url?: string | null
        }
        Update: {
          account_id?: string | null
          archived?: boolean
          created_at?: string
          id?: string
          prev_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: { Args: { required_role: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      _template: {
        Row: {
          archived: boolean
          created_at: string
          id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_schemas_and_tables: {
        Args: never
        Returns: {
          schema_name: string
          table_name: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  test: {
    Tables: {
      test: {
        Row: {
          age: number
          archived: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          age: number
          archived?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          age?: number
          archived?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  core: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  test: {
    Enums: {},
  },
} as const

export type SchemaName = keyof Database;

export type DatabasePivoted = {
	Row: {
		"core": {
			"account_notification": {
				"account_id": string;
				"archived": boolean;
				"created_at": string;
				"icon": string;
				"icon_type": string;
				"id": string;
				"link": string | null;
				"message": string;
				"read": boolean;
				"severity": string;
				"title": string;
			};
			"admin": {
				"archived": boolean;
				"created_at": string;
				"id": string;
			};
			"cached_request": {
				"archived": boolean;
				"created_at": string;
				"headers": string;
				"id": string;
				"response": string;
				"status": number;
				"ttl": number;
				"url": string;
			};
			"profile": {
				"archived": boolean;
				"created_at": string;
				"email": string;
				"first_name": string;
				"id": string;
				"last_name": string;
				"username": string;
			};
			"role": {
				"archived": boolean;
				"color": string;
				"created_at": string;
				"description": string;
				"id": string;
				"name": string;
			};
			"role_account": {
				"account": string | null;
				"archived": boolean;
				"created_at": string;
				"id": string;
				"role": string | null;
			};
			"session": {
				"account_id": string | null;
				"archived": boolean;
				"created_at": string;
				"id": string;
				"prev_url": string | null;
			};
		};
		"public": {
			"_template": {
				"archived": boolean;
				"created_at": string;
				"id": string;
			};
		};
		"test": {
			"test": {
				"age": number;
				"archived": boolean;
				"created_at": string;
				"id": string;
				"name": string;
			};
		};
	};
	Insert: {
		"core": {
			"account_notification": {
				"account_id": string;
				"archived"?: boolean;
				"created_at"?: string;
				"icon": string;
				"icon_type": string;
				"id"?: string;
				"link"?: string | null;
				"message": string;
				"read"?: boolean;
				"severity": string;
				"title": string;
			};
			"admin": {
				"archived"?: boolean;
				"created_at"?: string;
				"id"?: string;
			};
			"cached_request": {
				"archived"?: boolean;
				"created_at"?: string;
				"headers": string;
				"id"?: string;
				"response": string;
				"status": number;
				"ttl": number;
				"url": string;
			};
			"profile": {
				"archived"?: boolean;
				"created_at"?: string;
				"email": string;
				"first_name": string;
				"id": string;
				"last_name": string;
				"username": string;
			};
			"role": {
				"archived"?: boolean;
				"color": string;
				"created_at"?: string;
				"description": string;
				"id"?: string;
				"name": string;
			};
			"role_account": {
				"account"?: string | null;
				"archived"?: boolean;
				"created_at"?: string;
				"id"?: string;
				"role"?: string | null;
			};
			"session": {
				"account_id"?: string | null;
				"archived"?: boolean;
				"created_at"?: string;
				"id"?: string;
				"prev_url"?: string | null;
			};
		};
		"public": {
			"_template": {
				"archived"?: boolean;
				"created_at"?: string;
				"id"?: string;
			};
		};
		"test": {
			"test": {
				"age": number;
				"archived"?: boolean;
				"created_at"?: string;
				"id"?: string;
				"name": string;
			};
		};
	};
	Update: {
		"core": {
			"account_notification": {
				"account_id"?: string;
				"archived"?: boolean;
				"created_at"?: string;
				"icon"?: string;
				"icon_type"?: string;
				"id"?: string;
				"link"?: string | null;
				"message"?: string;
				"read"?: boolean;
				"severity"?: string;
				"title"?: string;
			};
			"admin": {
				"archived"?: boolean;
				"created_at"?: string;
				"id"?: string;
			};
			"cached_request": {
				"archived"?: boolean;
				"created_at"?: string;
				"headers"?: string;
				"id"?: string;
				"response"?: string;
				"status"?: number;
				"ttl"?: number;
				"url"?: string;
			};
			"profile": {
				"archived"?: boolean;
				"created_at"?: string;
				"email"?: string;
				"first_name"?: string;
				"id"?: string;
				"last_name"?: string;
				"username"?: string;
			};
			"role": {
				"archived"?: boolean;
				"color"?: string;
				"created_at"?: string;
				"description"?: string;
				"id"?: string;
				"name"?: string;
			};
			"role_account": {
				"account"?: string | null;
				"archived"?: boolean;
				"created_at"?: string;
				"id"?: string;
				"role"?: string | null;
			};
			"session": {
				"account_id"?: string | null;
				"archived"?: boolean;
				"created_at"?: string;
				"id"?: string;
				"prev_url"?: string | null;
			};
		};
		"public": {
			"_template": {
				"archived"?: boolean;
				"created_at"?: string;
				"id"?: string;
			};
		};
		"test": {
			"test": {
				"age"?: number;
				"archived"?: boolean;
				"created_at"?: string;
				"id"?: string;
				"name"?: string;
			};
		};
	};
	Relationships: {
		"core": {
			"account_notification": Database["core"]['Tables']["account_notification"]['Relationships'];
			"admin": Database["core"]['Tables']["admin"]['Relationships'];
			"cached_request": Database["core"]['Tables']["cached_request"]['Relationships'];
			"profile": Database["core"]['Tables']["profile"]['Relationships'];
			"role": Database["core"]['Tables']["role"]['Relationships'];
			"role_account": Database["core"]['Tables']["role_account"]['Relationships'];
			"session": Database["core"]['Tables']["session"]['Relationships'];
		};
		"public": {
			"_template": Database["public"]['Tables']["_template"]['Relationships'];
		};
		"test": {
			"test": Database["test"]['Tables']["test"]['Relationships'];
		};
	};
};