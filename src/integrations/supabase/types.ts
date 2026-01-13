export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      automation_rules: {
        Row: {
          action_type: string
          company_id: string | null
          condition_field: string
          condition_operator: string
          condition_value: string
          created_at: string
          id: string
          is_active: boolean
          match_count: number
          name: string
          target_category_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type?: string
          company_id?: string | null
          condition_field: string
          condition_operator: string
          condition_value: string
          created_at?: string
          id?: string
          is_active?: boolean
          match_count?: number
          name: string
          target_category_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_type?: string
          company_id?: string | null
          condition_field?: string
          condition_operator?: string
          condition_value?: string
          created_at?: string
          id?: string
          is_active?: boolean
          match_count?: number
          name?: string
          target_category_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_target_category_id_fkey"
            columns: ["target_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      bp_directors: {
        Row: {
          charges_rate: number | null
          company_id: string | null
          created_at: string | null
          end_date: string | null
          id: string
          monthly_remuneration: number | null
          name: string
          notes: string | null
          start_date: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          charges_rate?: number | null
          company_id?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          monthly_remuneration?: number | null
          name: string
          notes?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          charges_rate?: number | null
          company_id?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          monthly_remuneration?: number | null
          name?: string
          notes?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bp_directors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bp_fixed_expenses: {
        Row: {
          category: string | null
          company_id: string | null
          created_at: string | null
          end_date: string | null
          id: string
          is_vat_deductible: boolean | null
          monthly_amount: number | null
          name: string
          notes: string | null
          start_date: string
          updated_at: string | null
          user_id: string
          vat_rate: number | null
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_vat_deductible?: boolean | null
          monthly_amount?: number | null
          name: string
          notes?: string | null
          start_date?: string
          updated_at?: string | null
          user_id: string
          vat_rate?: number | null
        }
        Update: {
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_vat_deductible?: boolean | null
          monthly_amount?: number | null
          name?: string
          notes?: string | null
          start_date?: string
          updated_at?: string | null
          user_id?: string
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bp_fixed_expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bp_investments: {
        Row: {
          category: string | null
          company_id: string | null
          created_at: string | null
          depreciation_method: string | null
          depreciation_years: number | null
          id: string
          name: string
          notes: string | null
          purchase_amount: number
          purchase_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          depreciation_method?: string | null
          depreciation_years?: number | null
          id?: string
          name: string
          notes?: string | null
          purchase_amount?: number
          purchase_date?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          depreciation_method?: string | null
          depreciation_years?: number | null
          id?: string
          name?: string
          notes?: string | null
          purchase_amount?: number
          purchase_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bp_investments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bp_personnel: {
        Row: {
          company_id: string | null
          company_size: string | null
          contract_type: string | null
          created_at: string | null
          employer_charges_rate: number | null
          end_date: string | null
          gross_salary: number | null
          id: string
          is_executive: boolean | null
          notes: string | null
          position: string
          start_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          company_size?: string | null
          contract_type?: string | null
          created_at?: string | null
          employer_charges_rate?: number | null
          end_date?: string | null
          gross_salary?: number | null
          id?: string
          is_executive?: boolean | null
          notes?: string | null
          position: string
          start_date?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          company_size?: string | null
          contract_type?: string | null
          created_at?: string | null
          employer_charges_rate?: number | null
          end_date?: string | null
          gross_salary?: number | null
          id?: string
          is_executive?: boolean | null
          notes?: string | null
          position?: string
          start_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bp_personnel_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bp_revenue_forecasts: {
        Row: {
          amount: number | null
          company_id: string | null
          created_at: string | null
          id: string
          month: string
          notes: string | null
          stream_id: string
          unit_price: number | null
          units: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          month: string
          notes?: string | null
          stream_id: string
          unit_price?: number | null
          units?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          month?: string
          notes?: string | null
          stream_id?: string
          unit_price?: number | null
          units?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bp_revenue_forecasts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bp_revenue_forecasts_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "bp_revenue_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      bp_revenue_streams: {
        Row: {
          color: string | null
          company_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          model: string | null
          name: string
          updated_at: string | null
          user_id: string
          vat_rate: number | null
        }
        Insert: {
          color?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          model?: string | null
          name: string
          updated_at?: string | null
          user_id: string
          vat_rate?: number | null
        }
        Update: {
          color?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          model?: string | null
          name?: string
          updated_at?: string | null
          user_id?: string
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bp_revenue_streams_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bp_scenarios: {
        Row: {
          color: string | null
          company_id: string | null
          created_at: string | null
          expense_multiplier: number | null
          icon: string | null
          id: string
          is_default: boolean | null
          name: string
          revenue_multiplier: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          company_id?: string | null
          created_at?: string | null
          expense_multiplier?: number | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          revenue_multiplier?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          company_id?: string | null
          created_at?: string | null
          expense_multiplier?: number | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          revenue_multiplier?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bp_scenarios_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bp_settings: {
        Row: {
          company_id: string | null
          created_at: string | null
          customer_payment_delay: number | null
          id: string
          initial_cash: number | null
          is_pme: boolean | null
          projection_months: number | null
          supplier_payment_delay: number | null
          tax_regime: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          customer_payment_delay?: number | null
          id?: string
          initial_cash?: number | null
          is_pme?: boolean | null
          projection_months?: number | null
          supplier_payment_delay?: number | null
          tax_regime?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          customer_payment_delay?: number | null
          id?: string
          initial_cash?: number | null
          is_pme?: boolean | null
          projection_months?: number | null
          supplier_payment_delay?: number | null
          tax_regime?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bp_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          company_id: string | null
          created_at: string
          icon: string
          id: string
          name: string
          parent_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
          vat_rate: number
        }
        Insert: {
          color?: string
          company_id?: string | null
          created_at?: string
          icon?: string
          id?: string
          name: string
          parent_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
          vat_rate?: number
        }
        Update: {
          color?: string
          company_id?: string | null
          created_at?: string
          icon?: string
          id?: string
          name?: string
          parent_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_forecasts: {
        Row: {
          category_id: string
          company_id: string | null
          created_at: string
          expected_amount: number
          id: string
          month: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          company_id?: string | null
          created_at?: string
          expected_amount?: number
          id?: string
          month: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          company_id?: string | null
          created_at?: string
          expected_amount?: number
          id?: string
          month?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_forecasts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_forecasts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          bank_balance: number | null
          bank_balance_updated_at: string | null
          bridge_user_uuid: string | null
          created_at: string | null
          id: string
          initial_balance: number
          is_default: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bank_balance?: number | null
          bank_balance_updated_at?: string | null
          bridge_user_uuid?: string | null
          created_at?: string | null
          id?: string
          initial_balance?: number
          is_default?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bank_balance?: number | null
          bank_balance_updated_at?: string | null
          bridge_user_uuid?: string | null
          created_at?: string | null
          id?: string
          initial_balance?: number
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      company_secrets: {
        Row: {
          company_id: string
          created_at: string
          encrypted_value: string
          id: string
          secret_type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          encrypted_value: string
          id?: string
          secret_type?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          encrypted_value?: string
          id?: string
          secret_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_secrets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      forecasts: {
        Row: {
          actual_expense: number | null
          actual_income: number | null
          company_id: string | null
          created_at: string
          expected_expense: number
          expected_income: number
          id: string
          month: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_expense?: number | null
          actual_income?: number | null
          company_id?: string | null
          created_at?: string
          expected_expense?: number
          expected_income?: number
          id?: string
          month: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_expense?: number | null
          actual_income?: number | null
          company_id?: string | null
          created_at?: string
          expected_expense?: number
          expected_income?: number
          id?: string
          month?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecasts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string
          full_name: string | null
          id: string
          pennylane_api_key: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          pennylane_api_key?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          pennylane_api_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          ai_confidence: number | null
          amount: number
          bank_account_name: string | null
          category_id: string | null
          company_id: string | null
          created_at: string
          date: string
          description: string
          id: string
          is_reconciled: boolean
          pennylane_id: string | null
          source: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_confidence?: number | null
          amount: number
          bank_account_name?: string | null
          category_id?: string | null
          company_id?: string | null
          created_at?: string
          date: string
          description: string
          id?: string
          is_reconciled?: boolean
          pennylane_id?: string | null
          source?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_confidence?: number | null
          amount?: number
          bank_account_name?: string | null
          category_id?: string | null
          company_id?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          is_reconciled?: boolean
          pennylane_id?: string | null
          source?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      company_has_secret: {
        Args: { p_company_id: string; p_secret_type?: string }
        Returns: boolean
      }
    }
    Enums: {
      transaction_type: "income" | "expense"
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
  public: {
    Enums: {
      transaction_type: ["income", "expense"],
    },
  },
} as const
