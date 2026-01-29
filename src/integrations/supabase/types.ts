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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          organization_id: string | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
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
      bp_bonuses: {
        Row: {
          amount: number
          bonus_type: string
          business_plan_id: string
          created_at: string | null
          id: string
          is_exempt: boolean | null
          notes: string | null
          payment_month: string
          personnel_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          bonus_type?: string
          business_plan_id: string
          created_at?: string | null
          id?: string
          is_exempt?: boolean | null
          notes?: string | null
          payment_month: string
          personnel_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          bonus_type?: string
          business_plan_id?: string
          created_at?: string | null
          id?: string
          is_exempt?: boolean | null
          notes?: string | null
          payment_month?: string
          personnel_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bp_bonuses_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bp_bonuses_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "bp_personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      bp_directors: {
        Row: {
          business_plan_id: string | null
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
          business_plan_id?: string | null
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
          business_plan_id?: string | null
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
            foreignKeyName: "bp_directors_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bp_directors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bp_financings: {
        Row: {
          amount: number
          business_plan_id: string | null
          company_id: string | null
          created_at: string | null
          duration_months: number | null
          end_date: string | null
          financing_type: string
          id: string
          interest_rate: number | null
          investment_id: string | null
          is_blocked: boolean | null
          monthly_payment: number | null
          name: string
          notes: string | null
          start_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          business_plan_id?: string | null
          company_id?: string | null
          created_at?: string | null
          duration_months?: number | null
          end_date?: string | null
          financing_type?: string
          id?: string
          interest_rate?: number | null
          investment_id?: string | null
          is_blocked?: boolean | null
          monthly_payment?: number | null
          name: string
          notes?: string | null
          start_date?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          business_plan_id?: string | null
          company_id?: string | null
          created_at?: string | null
          duration_months?: number | null
          end_date?: string | null
          financing_type?: string
          id?: string
          interest_rate?: number | null
          investment_id?: string | null
          is_blocked?: boolean | null
          monthly_payment?: number | null
          name?: string
          notes?: string | null
          start_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bp_financings_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bp_financings_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "bp_investments"
            referencedColumns: ["id"]
          },
        ]
      }
      bp_fixed_expenses: {
        Row: {
          business_plan_id: string | null
          category: string | null
          company_id: string | null
          created_at: string | null
          end_date: string | null
          id: string
          is_vat_deductible: boolean | null
          monthly_amount: number | null
          name: string
          notes: string | null
          payment_frequency: string | null
          payment_months: number[] | null
          pcg_subcategory: string | null
          start_date: string
          updated_at: string | null
          user_id: string
          vat_rate: number | null
        }
        Insert: {
          business_plan_id?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_vat_deductible?: boolean | null
          monthly_amount?: number | null
          name: string
          notes?: string | null
          payment_frequency?: string | null
          payment_months?: number[] | null
          pcg_subcategory?: string | null
          start_date?: string
          updated_at?: string | null
          user_id: string
          vat_rate?: number | null
        }
        Update: {
          business_plan_id?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_vat_deductible?: boolean | null
          monthly_amount?: number | null
          name?: string
          notes?: string | null
          payment_frequency?: string | null
          payment_months?: number[] | null
          pcg_subcategory?: string | null
          start_date?: string
          updated_at?: string | null
          user_id?: string
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bp_fixed_expenses_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
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
          business_plan_id: string | null
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
          business_plan_id?: string | null
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
          business_plan_id?: string | null
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
            foreignKeyName: "bp_investments_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bp_investments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bp_notes: {
        Row: {
          business_plan_id: string | null
          company_id: string | null
          content: string | null
          created_at: string | null
          id: string
          section: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          business_plan_id?: string | null
          company_id?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          section: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          business_plan_id?: string | null
          company_id?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          section?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bp_notes_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bp_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bp_personnel: {
        Row: {
          at_mp_rate: number | null
          business_plan_id: string | null
          company_id: string | null
          company_size: string | null
          contract_type: string | null
          created_at: string | null
          daily_rate: number | null
          departure_type: string | null
          employer_charges_rate: number | null
          end_date: string | null
          estimated_days_per_month: number | null
          gross_salary: number | null
          id: string
          is_executive: boolean | null
          mutuelle_employer_amount: number | null
          name: string | null
          notes: string | null
          payslip_imported: boolean | null
          position: string
          severance_amount: number | null
          start_date: string
          updated_at: string | null
          user_id: string
          worker_type: string | null
        }
        Insert: {
          at_mp_rate?: number | null
          business_plan_id?: string | null
          company_id?: string | null
          company_size?: string | null
          contract_type?: string | null
          created_at?: string | null
          daily_rate?: number | null
          departure_type?: string | null
          employer_charges_rate?: number | null
          end_date?: string | null
          estimated_days_per_month?: number | null
          gross_salary?: number | null
          id?: string
          is_executive?: boolean | null
          mutuelle_employer_amount?: number | null
          name?: string | null
          notes?: string | null
          payslip_imported?: boolean | null
          position: string
          severance_amount?: number | null
          start_date?: string
          updated_at?: string | null
          user_id: string
          worker_type?: string | null
        }
        Update: {
          at_mp_rate?: number | null
          business_plan_id?: string | null
          company_id?: string | null
          company_size?: string | null
          contract_type?: string | null
          created_at?: string | null
          daily_rate?: number | null
          departure_type?: string | null
          employer_charges_rate?: number | null
          end_date?: string | null
          estimated_days_per_month?: number | null
          gross_salary?: number | null
          id?: string
          is_executive?: boolean | null
          mutuelle_employer_amount?: number | null
          name?: string | null
          notes?: string | null
          payslip_imported?: boolean | null
          position?: string
          severance_amount?: number | null
          start_date?: string
          updated_at?: string | null
          user_id?: string
          worker_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bp_personnel_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
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
          business_plan_id: string | null
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
          business_plan_id?: string | null
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
          business_plan_id?: string | null
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
            foreignKeyName: "bp_revenue_forecasts_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
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
          annual_growth_rate: number | null
          bad_debt_rate: number | null
          business_plan_id: string | null
          churn_rate: number | null
          color: string | null
          company_id: string | null
          created_at: string | null
          description: string | null
          growth_rate: number | null
          growth_rate_year2: number | null
          growth_rate_year3: number | null
          growth_rate_year4: number | null
          has_purchase_cost: boolean | null
          id: string
          initial_subscribers: number | null
          is_active: boolean | null
          model: string | null
          monthly_price: number | null
          name: string
          purchase_price: number | null
          updated_at: string | null
          user_id: string
          vat_rate: number | null
        }
        Insert: {
          annual_growth_rate?: number | null
          bad_debt_rate?: number | null
          business_plan_id?: string | null
          churn_rate?: number | null
          color?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          growth_rate?: number | null
          growth_rate_year2?: number | null
          growth_rate_year3?: number | null
          growth_rate_year4?: number | null
          has_purchase_cost?: boolean | null
          id?: string
          initial_subscribers?: number | null
          is_active?: boolean | null
          model?: string | null
          monthly_price?: number | null
          name: string
          purchase_price?: number | null
          updated_at?: string | null
          user_id: string
          vat_rate?: number | null
        }
        Update: {
          annual_growth_rate?: number | null
          bad_debt_rate?: number | null
          business_plan_id?: string | null
          churn_rate?: number | null
          color?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          growth_rate?: number | null
          growth_rate_year2?: number | null
          growth_rate_year3?: number | null
          growth_rate_year4?: number | null
          has_purchase_cost?: boolean | null
          id?: string
          initial_subscribers?: number | null
          is_active?: boolean | null
          model?: string | null
          monthly_price?: number | null
          name?: string
          purchase_price?: number | null
          updated_at?: string | null
          user_id?: string
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bp_revenue_streams_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bp_revenue_streams_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bp_scenario_overrides: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: string
          override_type: string
          override_value: number | null
          scenario_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          override_type: string
          override_value?: number | null
          scenario_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          override_type?: string
          override_value?: number | null
          scenario_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bp_scenario_overrides_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "bp_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      bp_scenarios: {
        Row: {
          business_plan_id: string | null
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
          business_plan_id?: string | null
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
          business_plan_id?: string | null
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
            foreignKeyName: "bp_scenarios_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
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
          bp_start_date: string | null
          bp_years: number | null
          company_id: string | null
          created_at: string | null
          customer_payment_delay: number | null
          fiscal_year_start_day: number | null
          fiscal_year_start_month: number | null
          id: string
          initial_cash: number | null
          is_pme: boolean | null
          projection_months: number | null
          show_financing: boolean | null
          show_funding_plan: boolean | null
          show_stocks: boolean | null
          supplier_payment_delay: number | null
          tax_regime: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bp_start_date?: string | null
          bp_years?: number | null
          company_id?: string | null
          created_at?: string | null
          customer_payment_delay?: number | null
          fiscal_year_start_day?: number | null
          fiscal_year_start_month?: number | null
          id?: string
          initial_cash?: number | null
          is_pme?: boolean | null
          projection_months?: number | null
          show_financing?: boolean | null
          show_funding_plan?: boolean | null
          show_stocks?: boolean | null
          supplier_payment_delay?: number | null
          tax_regime?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bp_start_date?: string | null
          bp_years?: number | null
          company_id?: string | null
          created_at?: string | null
          customer_payment_delay?: number | null
          fiscal_year_start_day?: number | null
          fiscal_year_start_month?: number | null
          id?: string
          initial_cash?: number | null
          is_pme?: boolean | null
          projection_months?: number | null
          show_financing?: boolean | null
          show_funding_plan?: boolean | null
          show_stocks?: boolean | null
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
      bp_snapshots: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          snapshot_data: Json
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          snapshot_data: Json
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          snapshot_data?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bp_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bp_stocks: {
        Row: {
          business_plan_id: string | null
          company_id: string | null
          created_at: string | null
          final_stock: number | null
          fiscal_year: number
          id: string
          initial_stock: number | null
          name: string
          notes: string | null
          purchase_amount: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          business_plan_id?: string | null
          company_id?: string | null
          created_at?: string | null
          final_stock?: number | null
          fiscal_year?: number
          id?: string
          initial_stock?: number | null
          name: string
          notes?: string | null
          purchase_amount?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          business_plan_id?: string | null
          company_id?: string | null
          created_at?: string | null
          final_stock?: number | null
          fiscal_year?: number
          id?: string
          initial_stock?: number | null
          name?: string
          notes?: string | null
          purchase_amount?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bp_stocks_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      bp_variable_expenses: {
        Row: {
          business_plan_id: string | null
          calculation_type: string | null
          category: string | null
          company_id: string | null
          created_at: string | null
          end_date: string | null
          id: string
          is_cogs: boolean | null
          is_vat_deductible: boolean | null
          linked_revenue_stream_id: string | null
          name: string
          notes: string | null
          percentage: number | null
          start_date: string
          unit_cost: number | null
          updated_at: string | null
          user_id: string
          vat_rate: number | null
        }
        Insert: {
          business_plan_id?: string | null
          calculation_type?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_cogs?: boolean | null
          is_vat_deductible?: boolean | null
          linked_revenue_stream_id?: string | null
          name: string
          notes?: string | null
          percentage?: number | null
          start_date?: string
          unit_cost?: number | null
          updated_at?: string | null
          user_id: string
          vat_rate?: number | null
        }
        Update: {
          business_plan_id?: string | null
          calculation_type?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_cogs?: boolean | null
          is_vat_deductible?: boolean | null
          linked_revenue_stream_id?: string | null
          name?: string
          notes?: string | null
          percentage?: number | null
          start_date?: string
          unit_cost?: number | null
          updated_at?: string | null
          user_id?: string
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bp_variable_expenses_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      bridge_accounts: {
        Row: {
          account_type: string | null
          balance: number | null
          bank_id: number | null
          bank_name: string | null
          bridge_account_id: number
          bridge_item_id: number
          bridge_user_uuid: string
          company_id: string
          created_at: string | null
          iban: string | null
          id: string
          last_sync_at: string | null
          name: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          account_type?: string | null
          balance?: number | null
          bank_id?: number | null
          bank_name?: string | null
          bridge_account_id: number
          bridge_item_id: number
          bridge_user_uuid: string
          company_id: string
          created_at?: string | null
          iban?: string | null
          id?: string
          last_sync_at?: string | null
          name?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          account_type?: string | null
          balance?: number | null
          bank_id?: number | null
          bank_name?: string | null
          bridge_account_id?: number
          bridge_item_id?: number
          bridge_user_uuid?: string
          company_id?: string
          created_at?: string | null
          iban?: string | null
          id?: string
          last_sync_at?: string | null
          name?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bridge_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bridge_sync_queue: {
        Row: {
          attempts: number | null
          bridge_account_id: number
          created_at: string | null
          event_type: string
          id: string
          last_error: string | null
          max_attempts: number | null
          payload: Json
          processed_at: string | null
          status: string | null
        }
        Insert: {
          attempts?: number | null
          bridge_account_id: number
          created_at?: string | null
          event_type: string
          id?: string
          last_error?: string | null
          max_attempts?: number | null
          payload: Json
          processed_at?: string | null
          status?: string | null
        }
        Update: {
          attempts?: number | null
          bridge_account_id?: number
          created_at?: string | null
          event_type?: string
          id?: string
          last_error?: string | null
          max_attempts?: number | null
          payload?: Json
          processed_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      business_plans: {
        Row: {
          bp_start_date: string | null
          bp_years: number | null
          company_id: string | null
          created_at: string | null
          customer_payment_delay: number | null
          description: string | null
          finalized_at: string | null
          fiscal_year_start_day: number | null
          fiscal_year_start_month: number | null
          id: string
          initial_cash: number | null
          is_pme: boolean | null
          name: string
          status: string
          supplier_payment_delay: number | null
          tax_regime: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bp_start_date?: string | null
          bp_years?: number | null
          company_id?: string | null
          created_at?: string | null
          customer_payment_delay?: number | null
          description?: string | null
          finalized_at?: string | null
          fiscal_year_start_day?: number | null
          fiscal_year_start_month?: number | null
          id?: string
          initial_cash?: number | null
          is_pme?: boolean | null
          name: string
          status?: string
          supplier_payment_delay?: number | null
          tax_regime?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bp_start_date?: string | null
          bp_years?: number | null
          company_id?: string | null
          created_at?: string | null
          customer_payment_delay?: number | null
          description?: string | null
          finalized_at?: string | null
          fiscal_year_start_day?: number | null
          fiscal_year_start_month?: number | null
          id?: string
          initial_cash?: number | null
          is_pme?: boolean | null
          name?: string
          status?: string
          supplier_payment_delay?: number | null
          tax_regime?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_plans_company_id_fkey"
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
          bp_expense_id: string | null
          bp_stream_id: string | null
          category_id: string
          company_id: string | null
          created_at: string
          expected_amount: number
          id: string
          month: string
          notes: string | null
          source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bp_expense_id?: string | null
          bp_stream_id?: string | null
          category_id: string
          company_id?: string | null
          created_at?: string
          expected_amount?: number
          id?: string
          month: string
          notes?: string | null
          source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bp_expense_id?: string | null
          bp_stream_id?: string | null
          category_id?: string
          company_id?: string | null
          created_at?: string
          expected_amount?: number
          id?: string
          month?: string
          notes?: string | null
          source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_forecasts_bp_expense_id_fkey"
            columns: ["bp_expense_id"]
            isOneToOne: false
            referencedRelation: "bp_fixed_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_forecasts_bp_stream_id_fkey"
            columns: ["bp_stream_id"]
            isOneToOne: false
            referencedRelation: "bp_revenue_streams"
            referencedColumns: ["id"]
          },
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
          bridge_accounts_count: number | null
          bridge_user_uuid: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          initial_balance: number
          is_default: boolean | null
          name: string
          organization_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bank_balance?: number | null
          bank_balance_updated_at?: string | null
          bridge_accounts_count?: number | null
          bridge_user_uuid?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          initial_balance?: number
          is_default?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bank_balance?: number | null
          bank_balance_updated_at?: string | null
          bridge_accounts_count?: number | null
          bridge_user_uuid?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          initial_balance?: number
          is_default?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_bridge_accounts: {
        Row: {
          bridge_account_id: number
          company_id: string
          created_at: string
          id: string
        }
        Insert: {
          bridge_account_id: number
          company_id: string
          created_at?: string
          id?: string
        }
        Update: {
          bridge_account_id?: number
          company_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_bridge_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invited_by: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      organization_invitations: {
        Row: {
          accepted_at: string | null
          company_ids: string[] | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          company_ids?: string[] | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          company_ids?: string[] | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_at: string | null
          invited_email: string | null
          joined_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_email?: string | null
          joined_at?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_email?: string | null
          joined_at?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_demo: boolean
          max_companies: number
          max_members: number
          max_transactions_per_month: number
          name: string
          owner_id: string | null
          plan: string
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          max_companies?: number
          max_members?: number
          max_transactions_per_month?: number
          name: string
          owner_id?: string | null
          plan?: string
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          max_companies?: number
          max_members?: number
          max_transactions_per_month?: number
          name?: string
          owner_id?: string | null
          plan?: string
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bp_enabled: boolean | null
          company_name: string | null
          created_at: string
          full_name: string | null
          id: string
          onboarding_completed: boolean | null
          onboarding_step: number | null
          pennylane_api_key: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bp_enabled?: boolean | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          pennylane_api_key?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bp_enabled?: boolean | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          pennylane_api_key?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscription_usage: {
        Row: {
          ai_calls: number
          companies_count: number
          created_at: string
          id: string
          month: string
          organization_id: string
          transactions_synced: number
          updated_at: string
        }
        Insert: {
          ai_calls?: number
          companies_count?: number
          created_at?: string
          id?: string
          month: string
          organization_id: string
          transactions_synced?: number
          updated_at?: string
        }
        Update: {
          ai_calls?: number
          companies_count?: number
          created_at?: string
          id?: string
          month?: string
          organization_id?: string
          transactions_synced?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      organization_members_safe: {
        Row: {
          created_at: string | null
          id: string | null
          invited_at: string | null
          invited_email: string | null
          joined_at: string | null
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          invited_at?: string | null
          invited_email?: never
          joined_at?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          invited_at?: string | null
          invited_email?: never
          joined_at?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: Json }
      add_company_member_by_email: {
        Args: { _company_id: string; _email: string }
        Returns: string
      }
      assign_superadmin_role: {
        Args: { user_email: string }
        Returns: undefined
      }
      cleanup_superadmin_tenant: {
        Args: { _user_id: string }
        Returns: undefined
      }
      company_has_secret: {
        Args: { p_company_id: string; p_secret_type?: string }
        Returns: boolean
      }
      delete_organization_cascade: {
        Args: { _org_id: string }
        Returns: undefined
      }
      generate_org_slug: { Args: { org_name: string }; Returns: string }
      get_company_members_with_email: {
        Args: { _company_id: string }
        Returns: {
          company_id: string
          created_at: string
          email: string
          id: string
          invited_by: string
          user_id: string
        }[]
      }
      get_invitation_by_token: {
        Args: { _token: string }
        Returns: {
          accepted_at: string
          company_ids: string[]
          email: string
          expires_at: string
          id: string
          organization_id: string
          organization_name: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_superadmin_global_stats: {
        Args: never
        Returns: {
          total_business_plans: number
          total_companies: number
          total_organizations: number
          total_transactions: number
          total_users: number
        }[]
      }
      get_superadmin_org_stats: {
        Args: never
        Returns: {
          bp_count: number
          company_count: number
          created_at: string
          is_demo: boolean
          max_companies: number
          max_members: number
          member_count: number
          name: string
          organization_id: string
          owner_email: string
          owner_id: string
          plan: string
          slug: string
          subscription_status: string
        }[]
      }
      get_user_email_for_superadmin: {
        Args: { _user_id: string }
        Returns: string
      }
      has_company_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
      seed_demo_companies: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "member" | "viewer" | "superadmin"
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
      app_role: ["owner", "admin", "member", "viewer", "superadmin"],
      transaction_type: ["income", "expense"],
    },
  },
} as const
