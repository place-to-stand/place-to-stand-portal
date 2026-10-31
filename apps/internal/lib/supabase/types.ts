export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activity_logs: {
        Row: {
          actor_id: string | null
          actor_role: Database['public']['Enums']['user_role'] | null
          context_route: string | null
          created_at: string
          id: string
          metadata: NonNullable<Json>
          source: Database['public']['Enums']['activity_source']
          summary: string
          target_company_id: string | null
          target_id: string | null
          target_project_id: string | null
          target_type: string
          verb: string
        }
        ComputedFields: never
        Insert: {
          actor_id?: string | null
          actor_role?: Database['public']['Enums']['user_role'] | null
          context_route?: string | null
          created_at?: string
          id?: string
          metadata?: NonNullable<Json>
          source?: Database['public']['Enums']['activity_source']
          summary: string
          target_company_id?: string | null
          target_id?: string | null
          target_project_id?: string | null
          target_type: string
          verb: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: Database['public']['Enums']['user_role'] | null
          context_route?: string | null
          created_at?: string
          id?: string
          metadata?: NonNullable<Json>
          source?: Database['public']['Enums']['activity_source']
          summary?: string
          target_company_id?: string | null
          target_id?: string | null
          target_project_id?: string | null
          target_type?: string
          verb?: string
        }
        Relationships: [
          {
            foreignKeyName: 'activity_logs_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      activity_overview_cache: {
        Row: {
          cached_at: string
          created_at: string
          expires_at: string
          id: string
          summary: NonNullable<Json>
          timeframe_days: number
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          cached_at?: string
          created_at?: string
          expires_at: string
          id?: string
          summary: NonNullable<Json>
          timeframe_days: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cached_at?: string
          created_at?: string
          expires_at?: string
          id?: string
          summary?: NonNullable<Json>
          timeframe_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'activity_overview_cache_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      billing_terms: {
        Row: {
          billing_type: Database['public']['Enums']['client_billing_type']
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          effective_from: string
          id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          billing_type: Database['public']['Enums']['client_billing_type']
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from: string
          id?: string
          updated_at?: string
        }
        Update: {
          billing_type?: Database['public']['Enums']['client_billing_type']
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'billing_terms_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'client_portal_access'
            referencedColumns: ['company_id']
          },
          {
            foreignKeyName: 'billing_terms_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'billing_terms_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      client_updates: {
        Row: {
          closing: string
          company_id: string
          created_at: string
          created_by_id: string
          deleted_at: string | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          intro: string
          items: NonNullable<Json>
          period_end: string
          period_start: string
          recipients: NonNullable<Json>
          sent_at: string | null
          sent_by_id: string | null
          status: Database['public']['Enums']['client_update_status']
          subject: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          closing?: string
          company_id: string
          created_at?: string
          created_by_id: string
          deleted_at?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          intro?: string
          items?: NonNullable<Json>
          period_end: string
          period_start: string
          recipients?: NonNullable<Json>
          sent_at?: string | null
          sent_by_id?: string | null
          status?: Database['public']['Enums']['client_update_status']
          subject: string
          updated_at?: string
        }
        Update: {
          closing?: string
          company_id?: string
          created_at?: string
          created_by_id?: string
          deleted_at?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          intro?: string
          items?: NonNullable<Json>
          period_end?: string
          period_start?: string
          recipients?: NonNullable<Json>
          sent_at?: string | null
          sent_by_id?: string | null
          status?: Database['public']['Enums']['client_update_status']
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'client_updates_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'client_portal_access'
            referencedColumns: ['company_id']
          },
          {
            foreignKeyName: 'client_updates_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'client_updates_created_by_id_fkey'
            columns: ['created_by_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'client_updates_sent_by_id_fkey'
            columns: ['sent_by_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      commission_term_closers: {
        Row: {
          closer_contact_id: string | null
          closer_user_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          share_percent: number
          term_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          closer_contact_id?: string | null
          closer_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          share_percent: number
          term_id: string
          updated_at?: string
        }
        Update: {
          closer_contact_id?: string | null
          closer_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          share_percent?: number
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'commission_term_closers_closer_contact_id_fkey'
            columns: ['closer_contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'commission_term_closers_closer_user_id_fkey'
            columns: ['closer_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'commission_term_closers_term_id_fkey'
            columns: ['term_id']
            isOneToOne: false
            referencedRelation: 'commission_terms'
            referencedColumns: ['id']
          },
        ]
      }
      commission_terms: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          effective_from: string
          id: string
          origination_contact_id: string | null
          origination_user_id: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from: string
          id?: string
          origination_contact_id?: string | null
          origination_user_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from?: string
          id?: string
          origination_contact_id?: string | null
          origination_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'commission_terms_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'client_portal_access'
            referencedColumns: ['company_id']
          },
          {
            foreignKeyName: 'commission_terms_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'commission_terms_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'commission_terms_origination_contact_id_fkey'
            columns: ['origination_contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'commission_terms_origination_user_id_fkey'
            columns: ['origination_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      companies: {
        Row: {
          client_ended_at: string | null
          client_since: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          linkedin_url: string | null
          name: string
          notes: string | null
          slug: string | null
          state: string | null
          updated_at: string
          website: string | null
        }
        ComputedFields: never
        Insert: {
          client_ended_at?: string | null
          client_since?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          linkedin_url?: string | null
          name: string
          notes?: string | null
          slug?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          client_ended_at?: string | null
          client_since?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          linkedin_url?: string | null
          name?: string
          notes?: string | null
          slug?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'companies_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      contacts: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          linkedin_url: string | null
          name: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          linkedin_url?: string | null
          name: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          linkedin_url?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'contacts_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contacts_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      form_submissions: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          answered_count: number | null
          captured_at: string | null
          completed_at: string | null
          confirmation_email_claimed_at: string | null
          confirmation_sent_at: string | null
          contact_company: string | null
          contact_email: string | null
          contact_name: string | null
          contact_website: string | null
          created_at: string
          deleted_at: string | null
          delivery_requested_at: string | null
          destroyed_at: string | null
          duration_ms: number | null
          feedback_at: string | null
          feedback_comment: string | null
          feedback_helpful: boolean | null
          furthest_step_index: number | null
          gclid: string | null
          id: string
          kind: Database['public']['Enums']['form_submission_kind']
          landing_path: string | null
          language: string | null
          last_activity_at: string
          last_trigger: string | null
          marketing_consent: boolean | null
          message: string | null
          percent_complete: number | null
          phase_id: string | null
          posthog_distinct_id: string | null
          posthog_replay_url: string | null
          posthog_session_id: string | null
          questions_total: number | null
          referrer: string | null
          responses: Json | null
          result: Json | null
          screen_width: number | null
          session_key: string
          source_detail: string
          started_at: string
          status: Database['public']['Enums']['form_submission_status']
          steps_total: number | null
          subject: string | null
          team_email_claimed_at: string | null
          team_notified_at: string | null
          timezone: string | null
          top_service_id: string | null
          updated_at: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          viewport: string | null
        }
        ComputedFields: never
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          answered_count?: number | null
          captured_at?: string | null
          completed_at?: string | null
          confirmation_email_claimed_at?: string | null
          confirmation_sent_at?: string | null
          contact_company?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_website?: string | null
          created_at?: string
          deleted_at?: string | null
          delivery_requested_at?: string | null
          destroyed_at?: string | null
          duration_ms?: number | null
          feedback_at?: string | null
          feedback_comment?: string | null
          feedback_helpful?: boolean | null
          furthest_step_index?: number | null
          gclid?: string | null
          id?: string
          kind: Database['public']['Enums']['form_submission_kind']
          landing_path?: string | null
          language?: string | null
          last_activity_at: string
          last_trigger?: string | null
          marketing_consent?: boolean | null
          message?: string | null
          percent_complete?: number | null
          phase_id?: string | null
          posthog_distinct_id?: string | null
          posthog_replay_url?: string | null
          posthog_session_id?: string | null
          questions_total?: number | null
          referrer?: string | null
          responses?: Json | null
          result?: Json | null
          screen_width?: number | null
          session_key: string
          source_detail: string
          started_at: string
          status: Database['public']['Enums']['form_submission_status']
          steps_total?: number | null
          subject?: string | null
          team_email_claimed_at?: string | null
          team_notified_at?: string | null
          timezone?: string | null
          top_service_id?: string | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          viewport?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          answered_count?: number | null
          captured_at?: string | null
          completed_at?: string | null
          confirmation_email_claimed_at?: string | null
          confirmation_sent_at?: string | null
          contact_company?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_website?: string | null
          created_at?: string
          deleted_at?: string | null
          delivery_requested_at?: string | null
          destroyed_at?: string | null
          duration_ms?: number | null
          feedback_at?: string | null
          feedback_comment?: string | null
          feedback_helpful?: boolean | null
          furthest_step_index?: number | null
          gclid?: string | null
          id?: string
          kind?: Database['public']['Enums']['form_submission_kind']
          landing_path?: string | null
          language?: string | null
          last_activity_at?: string
          last_trigger?: string | null
          marketing_consent?: boolean | null
          message?: string | null
          percent_complete?: number | null
          phase_id?: string | null
          posthog_distinct_id?: string | null
          posthog_replay_url?: string | null
          posthog_session_id?: string | null
          questions_total?: number | null
          referrer?: string | null
          responses?: Json | null
          result?: Json | null
          screen_width?: number | null
          session_key?: string
          source_detail?: string
          started_at?: string
          status?: Database['public']['Enums']['form_submission_status']
          steps_total?: number | null
          subject?: string | null
          team_email_claimed_at?: string | null
          team_notified_at?: string | null
          timezone?: string | null
          top_service_id?: string | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          viewport?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'form_submissions_acknowledged_by_users_id_fk'
            columns: ['acknowledged_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      github_app_installations: {
        Row: {
          account_avatar_url: string | null
          account_id: number
          account_login: string
          account_type: string
          company_id: string
          created_at: string
          deleted_at: string | null
          events: string[]
          id: string
          installation_id: number
          installed_by_user_id: string
          last_verified_at: string | null
          permissions: NonNullable<Json>
          repository_selection: string
          status: Database['public']['Enums']['github_app_installation_status']
          suspended_at: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          account_avatar_url?: string | null
          account_id: number
          account_login: string
          account_type: string
          company_id: string
          created_at?: string
          deleted_at?: string | null
          events?: string[]
          id?: string
          installation_id: number
          installed_by_user_id: string
          last_verified_at?: string | null
          permissions?: NonNullable<Json>
          repository_selection: string
          status?: Database['public']['Enums']['github_app_installation_status']
          suspended_at?: string | null
          updated_at?: string
        }
        Update: {
          account_avatar_url?: string | null
          account_id?: number
          account_login?: string
          account_type?: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          events?: string[]
          id?: string
          installation_id?: number
          installed_by_user_id?: string
          last_verified_at?: string | null
          permissions?: NonNullable<Json>
          repository_selection?: string
          status?: Database['public']['Enums']['github_app_installation_status']
          suspended_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'github_app_installations_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'client_portal_access'
            referencedColumns: ['company_id']
          },
          {
            foreignKeyName: 'github_app_installations_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'github_app_installations_installed_by_user_id_fkey'
            columns: ['installed_by_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      github_repo_links: {
        Row: {
          created_at: string
          default_branch: string
          deleted_at: string | null
          github_app_installation_id: string | null
          id: string
          is_active: boolean
          linked_by: string
          oauth_connection_id: string | null
          project_id: string
          repo_full_name: string
          repo_id: number
          repo_name: string
          repo_owner: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          default_branch?: string
          deleted_at?: string | null
          github_app_installation_id?: string | null
          id?: string
          is_active?: boolean
          linked_by: string
          oauth_connection_id?: string | null
          project_id: string
          repo_full_name: string
          repo_id: number
          repo_name: string
          repo_owner: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_branch?: string
          deleted_at?: string | null
          github_app_installation_id?: string | null
          id?: string
          is_active?: boolean
          linked_by?: string
          oauth_connection_id?: string | null
          project_id?: string
          repo_full_name?: string
          repo_id?: number
          repo_name?: string
          repo_owner?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'github_repo_links_github_app_installation_id_fkey'
            columns: ['github_app_installation_id']
            isOneToOne: false
            referencedRelation: 'github_app_installations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'github_repo_links_linked_by_fkey'
            columns: ['linked_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'github_repo_links_oauth_connection_id_fkey'
            columns: ['oauth_connection_id']
            isOneToOne: false
            referencedRelation: 'oauth_connections'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'github_repo_links_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      hour_blocks: {
        Row: {
          billing_month: string
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          hours_purchased: number
          id: string
          invoice_line_item_id: string | null
          notes: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          billing_month: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          hours_purchased: number
          id?: string
          invoice_line_item_id?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          billing_month?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          hours_purchased?: number
          id?: string
          invoice_line_item_id?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'hour_blocks_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'client_portal_access'
            referencedColumns: ['company_id']
          },
          {
            foreignKeyName: 'hour_blocks_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'hour_blocks_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'hour_blocks_invoice_line_item_id_fkey'
            columns: ['invoice_line_item_id']
            isOneToOne: false
            referencedRelation: 'invoice_line_items'
            referencedColumns: ['id']
          },
        ]
      }
      invoice_line_items: {
        Row: {
          amount: number
          created_at: string
          creates_hour_block: boolean
          deleted_at: string | null
          description: string
          id: string
          invoice_id: string
          product_catalog_item_id: string | null
          quantity: number
          sort_order: number
          unit_price: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          amount: number
          created_at?: string
          creates_hour_block?: boolean
          deleted_at?: string | null
          description: string
          id?: string
          invoice_id: string
          product_catalog_item_id?: string | null
          quantity: number
          sort_order?: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          creates_hour_block?: boolean
          deleted_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
          product_catalog_item_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invoice_line_items_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoices'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoice_line_items_product_catalog_item_id_fkey'
            columns: ['product_catalog_item_id']
            isOneToOne: false
            referencedRelation: 'product_catalog_items'
            referencedColumns: ['id']
          },
        ]
      }
      invoices: {
        Row: {
          billing_type:
            Database['public']['Enums']['client_billing_type'] | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          due_date: string | null
          id: string
          invoice_number: string | null
          issued_date: string | null
          notes: string | null
          paid_at: string | null
          share_enabled: boolean
          share_token: string | null
          status: Database['public']['Enums']['invoice_status']
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          subtotal: number
          tax_amount: number
          tax_rate: number | null
          total: number
          updated_at: string
          viewed_at: string | null
          viewed_count: number
        }
        ComputedFields: never
        Insert: {
          billing_type?:
            Database['public']['Enums']['client_billing_type'] | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issued_date?: string | null
          notes?: string | null
          paid_at?: string | null
          share_enabled?: boolean
          share_token?: string | null
          status?: Database['public']['Enums']['invoice_status']
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number | null
          total?: number
          updated_at?: string
          viewed_at?: string | null
          viewed_count?: number
        }
        Update: {
          billing_type?:
            Database['public']['Enums']['client_billing_type'] | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issued_date?: string | null
          notes?: string | null
          paid_at?: string | null
          share_enabled?: boolean
          share_token?: string | null
          status?: Database['public']['Enums']['invoice_status']
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number | null
          total?: number
          updated_at?: string
          viewed_at?: string | null
          viewed_count?: number
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'client_portal_access'
            referencedColumns: ['company_id']
          },
          {
            foreignKeyName: 'invoices_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      lead_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: Database['public']['Enums']['lead_status'] | null
          id: string
          lead_id: string
          to_status: Database['public']['Enums']['lead_status']
        }
        ComputedFields: never
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database['public']['Enums']['lead_status'] | null
          id?: string
          lead_id: string
          to_status: Database['public']['Enums']['lead_status']
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database['public']['Enums']['lead_status'] | null
          id?: string
          lead_id?: string
          to_status?: Database['public']['Enums']['lead_status']
        }
        Relationships: [
          {
            foreignKeyName: 'lead_stage_history_changed_by_fkey'
            columns: ['changed_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lead_stage_history_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
        ]
      }
      lead_updates: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          lead_id: string
          occurred_at: string
          type: Database['public']['Enums']['lead_update_type']
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          lead_id: string
          occurred_at?: string
          type: Database['public']['Enums']['lead_update_type']
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          lead_id?: string
          occurred_at?: string
          type?: Database['public']['Enums']['lead_update_type']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lead_updates_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lead_updates_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
        ]
      }
      leads: {
        Row: {
          assignee_id: string | null
          awaiting_reply: boolean | null
          company_id: string | null
          contact_id: string
          converted_at: string | null
          created_at: string
          current_stage_entered_at: string | null
          deleted_at: string | null
          expected_close_date: string | null
          id: string
          last_contact_at: string | null
          loss_notes: string | null
          loss_reason: Database['public']['Enums']['lead_loss_reason'] | null
          notes: NonNullable<Json>
          rank: string
          resolved_at: string | null
          source_detail: string | null
          source_type: string | null
          status: Database['public']['Enums']['lead_status']
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          assignee_id?: string | null
          awaiting_reply?: boolean | null
          company_id?: string | null
          contact_id: string
          converted_at?: string | null
          created_at?: string
          current_stage_entered_at?: string | null
          deleted_at?: string | null
          expected_close_date?: string | null
          id?: string
          last_contact_at?: string | null
          loss_notes?: string | null
          loss_reason?: Database['public']['Enums']['lead_loss_reason'] | null
          notes?: NonNullable<Json>
          rank?: string
          resolved_at?: string | null
          source_detail?: string | null
          source_type?: string | null
          status?: Database['public']['Enums']['lead_status']
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          awaiting_reply?: boolean | null
          company_id?: string | null
          contact_id?: string
          converted_at?: string | null
          created_at?: string
          current_stage_entered_at?: string | null
          deleted_at?: string | null
          expected_close_date?: string | null
          id?: string
          last_contact_at?: string | null
          loss_notes?: string | null
          loss_reason?: Database['public']['Enums']['lead_loss_reason'] | null
          notes?: NonNullable<Json>
          rank?: string
          resolved_at?: string | null
          source_detail?: string | null
          source_type?: string | null
          status?: Database['public']['Enums']['lead_status']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'leads_assignee_id_fkey'
            columns: ['assignee_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'leads_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'client_portal_access'
            referencedColumns: ['company_id']
          },
          {
            foreignKeyName: 'leads_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'leads_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
        ]
      }
      memberships: {
        Row: {
          company_id: string
          contact_id: string
          created_at: string
          ended_at: string | null
          id: string
          is_primary: boolean
          portal_access: boolean
          started_at: string
          title: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          contact_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          is_primary?: boolean
          portal_access?: boolean
          started_at?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          contact_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          is_primary?: boolean
          portal_access?: boolean
          started_at?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'memberships_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'client_portal_access'
            referencedColumns: ['company_id']
          },
          {
            foreignKeyName: 'memberships_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'memberships_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
        ]
      }
      monthly_close_snapshots: {
        Row: {
          closed_at: string
          closed_by: string | null
          created_at: string
          deleted_at: string | null
          id: string
          month: number
          report: NonNullable<Json>
          updated_at: string
          year: number
        }
        ComputedFields: never
        Insert: {
          closed_at?: string
          closed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          month: number
          report: NonNullable<Json>
          updated_at?: string
          year: number
        }
        Update: {
          closed_at?: string
          closed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          month?: number
          report?: NonNullable<Json>
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: 'monthly_close_snapshots_closed_by_fkey'
            columns: ['closed_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          cleared_at: string | null
          created_at: string
          dedupe_key: string | null
          href: string | null
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          actor_id?: string | null
          body?: string | null
          cleared_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          href?: string | null
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          cleared_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          href?: string | null
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      oauth_connections: {
        Row: {
          access_token: string
          access_token_expires_at: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          id: string
          last_sync_at: string | null
          provider: Database['public']['Enums']['oauth_provider']
          provider_account_id: string
          provider_email: string | null
          provider_metadata: NonNullable<Json>
          refresh_token: string | null
          scopes: string[]
          status: Database['public']['Enums']['oauth_connection_status']
          sync_state: NonNullable<Json>
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          access_token: string
          access_token_expires_at?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id?: string
          last_sync_at?: string | null
          provider: Database['public']['Enums']['oauth_provider']
          provider_account_id: string
          provider_email?: string | null
          provider_metadata?: NonNullable<Json>
          refresh_token?: string | null
          scopes: string[]
          status?: Database['public']['Enums']['oauth_connection_status']
          sync_state?: NonNullable<Json>
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          access_token_expires_at?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id?: string
          last_sync_at?: string | null
          provider?: Database['public']['Enums']['oauth_provider']
          provider_account_id?: string
          provider_email?: string | null
          provider_metadata?: NonNullable<Json>
          refresh_token?: string | null
          scopes?: string[]
          status?: Database['public']['Enums']['oauth_connection_status']
          sync_state?: NonNullable<Json>
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'oauth_connections_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      plan_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          thread_id: string
        }
        ComputedFields: never
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'plan_messages_thread_id_fkey'
            columns: ['thread_id']
            isOneToOne: false
            referencedRelation: 'plan_threads'
            referencedColumns: ['id']
          },
        ]
      }
      plan_revisions: {
        Row: {
          content: string
          created_at: string
          feedback: string | null
          id: string
          thread_id: string
          version: number
        }
        ComputedFields: never
        Insert: {
          content: string
          created_at?: string
          feedback?: string | null
          id?: string
          thread_id: string
          version: number
        }
        Update: {
          content?: string
          created_at?: string
          feedback?: string | null
          id?: string
          thread_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: 'plan_revisions_thread_id_fkey'
            columns: ['thread_id']
            isOneToOne: false
            referencedRelation: 'plan_threads'
            referencedColumns: ['id']
          },
        ]
      }
      plan_threads: {
        Row: {
          created_at: string
          current_version: number
          generating_version: number | null
          generation_error: string | null
          generation_status: Database['public']['Enums']['plan_thread_generation_status']
          id: string
          model: string
          model_label: string
          partial_content: string | null
          session_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          current_version?: number
          generating_version?: number | null
          generation_error?: string | null
          generation_status?: Database['public']['Enums']['plan_thread_generation_status']
          id?: string
          model: string
          model_label: string
          partial_content?: string | null
          session_id: string
        }
        Update: {
          created_at?: string
          current_version?: number
          generating_version?: number | null
          generation_error?: string | null
          generation_status?: Database['public']['Enums']['plan_thread_generation_status']
          id?: string
          model?: string
          model_label?: string
          partial_content?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'plan_threads_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'planning_sessions'
            referencedColumns: ['id']
          },
        ]
      }
      planning_sessions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          repo_link_id: string
          status: Database['public']['Enums']['planning_session_status']
          task_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          repo_link_id: string
          status?: Database['public']['Enums']['planning_session_status']
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          repo_link_id?: string
          status?: Database['public']['Enums']['planning_session_status']
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'planning_sessions_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'planning_sessions_repo_link_id_fkey'
            columns: ['repo_link_id']
            isOneToOne: false
            referencedRelation: 'github_repo_links'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'planning_sessions_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
      product_catalog_items: {
        Row: {
          created_at: string
          creates_hour_block_default: boolean
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          min_quantity: number | null
          name: string
          sort_order: number
          unit_label: string
          unit_price: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          creates_hour_block_default?: boolean
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          min_quantity?: number | null
          name: string
          sort_order?: number
          unit_label?: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          creates_hour_block_default?: boolean
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          min_quantity?: number | null
          name?: string
          sort_order?: number
          unit_label?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      project_integration_links: {
        Row: {
          created_at: string
          deleted_at: string | null
          external_id: string
          external_name: string
          id: string
          linked_by: string
          metadata: NonNullable<Json>
          owner_id: string | null
          owner_name: string | null
          owner_slug: string | null
          project_id: string
          provider: Database['public']['Enums']['integration_provider']
          updated_at: string
          url: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          deleted_at?: string | null
          external_id: string
          external_name: string
          id?: string
          linked_by: string
          metadata?: NonNullable<Json>
          owner_id?: string | null
          owner_name?: string | null
          owner_slug?: string | null
          project_id: string
          provider: Database['public']['Enums']['integration_provider']
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          external_id?: string
          external_name?: string
          id?: string
          linked_by?: string
          metadata?: NonNullable<Json>
          owner_id?: string | null
          owner_name?: string | null
          owner_slug?: string | null
          project_id?: string
          provider?: Database['public']['Enums']['integration_provider']
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_integration_links_linked_by_fkey'
            columns: ['linked_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_integration_links_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          project_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_members_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_members_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      projects: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          ends_on: string | null
          id: string
          name: string
          owner_id: string | null
          slug: string | null
          starts_on: string | null
          status: Database['public']['Enums']['project_status']
          type: Database['public']['Enums']['project_type']
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          ends_on?: string | null
          id?: string
          name: string
          owner_id?: string | null
          slug?: string | null
          starts_on?: string | null
          status?: Database['public']['Enums']['project_status']
          type?: Database['public']['Enums']['project_type']
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          ends_on?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          slug?: string | null
          starts_on?: string | null
          status?: Database['public']['Enums']['project_status']
          type?: Database['public']['Enums']['project_type']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'projects_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'client_portal_access'
            referencedColumns: ['company_id']
          },
          {
            foreignKeyName: 'projects_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'projects_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'projects_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      rate_limit_buckets: {
        Row: {
          count: number
          key: string
          updated_at: string
          window_start: string
        }
        ComputedFields: never
        Insert: {
          count?: number
          key: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      task_assignee_metadata: {
        Row: {
          created_at: string
          deleted_at: string | null
          sort_order: number
          task_id: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          deleted_at?: string | null
          sort_order: number
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          sort_order?: number
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'task_assignee_metadata_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_assignee_metadata_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      task_assignees: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: number
          task_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: number
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: number
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'task_assignees_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_assignees_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          deleted_at: string | null
          file_size: number
          id: string
          mime_type: string
          original_name: string
          storage_path: string
          task_id: string
          updated_at: string
          uploaded_by: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          deleted_at?: string | null
          file_size: number
          id?: string
          mime_type: string
          original_name: string
          storage_path: string
          task_id: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          file_size?: number
          id?: string
          mime_type?: string
          original_name?: string
          storage_path?: string
          task_id?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: 'task_attachments_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_attachments_uploaded_by_fkey'
            columns: ['uploaded_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          task_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'task_comments_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_comments_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
      task_deployments: {
        Row: {
          created_at: string
          created_by: string
          github_issue_number: number
          github_issue_url: string
          id: string
          mode: string | null
          model: string | null
          plan_id: string
          plan_thread_id: string | null
          plan_version: number | null
          pr_url: string | null
          repo_link_id: string
          task_id: string
          updated_at: string
          worker_status: Database['public']['Enums']['worker_status']
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by: string
          github_issue_number: number
          github_issue_url: string
          id?: string
          mode?: string | null
          model?: string | null
          plan_id: string
          plan_thread_id?: string | null
          plan_version?: number | null
          pr_url?: string | null
          repo_link_id: string
          task_id: string
          updated_at?: string
          worker_status: Database['public']['Enums']['worker_status']
        }
        Update: {
          created_at?: string
          created_by?: string
          github_issue_number?: number
          github_issue_url?: string
          id?: string
          mode?: string | null
          model?: string | null
          plan_id?: string
          plan_thread_id?: string | null
          plan_version?: number | null
          pr_url?: string | null
          repo_link_id?: string
          task_id?: string
          updated_at?: string
          worker_status?: Database['public']['Enums']['worker_status']
        }
        Relationships: [
          {
            foreignKeyName: 'task_deployments_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_deployments_repo_link_id_fkey'
            columns: ['repo_link_id']
            isOneToOne: false
            referencedRelation: 'github_repo_links'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_deployments_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
      tasks: {
        Row: {
          accepted_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          due_on: string | null
          github_issue_number: number | null
          github_issue_url: string | null
          id: string
          lead_id: string | null
          project_id: string
          rank: string
          status: Database['public']['Enums']['task_status']
          title: string
          updated_at: string
          updated_by: string | null
          worker_status: Database['public']['Enums']['worker_status'] | null
        }
        ComputedFields: never
        Insert: {
          accepted_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_on?: string | null
          github_issue_number?: number | null
          github_issue_url?: string | null
          id?: string
          lead_id?: string | null
          project_id: string
          rank?: string
          status?: Database['public']['Enums']['task_status']
          title: string
          updated_at?: string
          updated_by?: string | null
          worker_status?: Database['public']['Enums']['worker_status'] | null
        }
        Update: {
          accepted_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_on?: string | null
          github_issue_number?: number | null
          github_issue_url?: string | null
          id?: string
          lead_id?: string | null
          project_id?: string
          rank?: string
          status?: Database['public']['Enums']['task_status']
          title?: string
          updated_at?: string
          updated_by?: string | null
          worker_status?: Database['public']['Enums']['worker_status'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      tax_rates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          rate: number
          state: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          rate: number
          state: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          rate?: number
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      time_log_tasks: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          task_id: string
          time_log_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          task_id: string
          time_log_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          task_id?: string
          time_log_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'time_log_tasks_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'time_log_tasks_time_log_id_fkey'
            columns: ['time_log_id']
            isOneToOne: false
            referencedRelation: 'time_logs'
            referencedColumns: ['id']
          },
        ]
      }
      time_logs: {
        Row: {
          created_at: string
          deleted_at: string | null
          hours: number
          id: string
          logged_on: string
          note: string | null
          project_id: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          deleted_at?: string | null
          hours: number
          id?: string
          logged_on?: string
          note?: string | null
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          hours?: number
          id?: string
          logged_on?: string
          note?: string | null
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'time_logs_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'time_logs_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      user_dashboard_layouts: {
        Row: {
          created_at: string
          layout: NonNullable<Json>
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          layout: NonNullable<Json>
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          layout?: NonNullable<Json>
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_dashboard_layouts_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          deleted_at: string | null
          disabled_at: string | null
          email: string
          id: string
          onboarding_completed_at: string | null
          role: Database['public']['Enums']['user_role']
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          deleted_at?: string | null
          disabled_at?: string | null
          email: string
          id: string
          onboarding_completed_at?: string | null
          role?: Database['public']['Enums']['user_role']
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          disabled_at?: string | null
          email?: string
          id?: string
          onboarding_completed_at?: string | null
          role?: Database['public']['Enums']['user_role']
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      client_portal_access: {
        Row: {
          company_id: string
          contact_id: string
          user_id: string | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: 'contacts_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'memberships_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Functions: {
      log_activity: {
        Args: {
          p_actor_id: string
          p_actor_role: Database['public']['Enums']['user_role']
          p_context_route?: string
          p_metadata?: Json
          p_summary: string
          p_target_client_id?: string
          p_target_id?: string
          p_target_project_id?: string
          p_target_type: string
          p_verb: string
        }
        Returns: undefined
      }
      resolve_actor_role: {
        Args: { p_actor_id: string }
        Returns: Database['public']['Enums']['user_role']
      }
      task_matches_project: {
        Args: { p_project_id: string; p_task_id: string }
        Returns: boolean
      }
      time_log_task_matches_project: {
        Args: { p_task_id: string; p_time_log_id: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_source: 'ADMIN_UI' | 'CLI' | 'MCP' | 'SYSTEM'
      client_billing_type: 'prepaid' | 'net_30'
      client_update_status: 'DRAFT' | 'SENT'
      form_submission_kind: 'audit' | 'contact'
      form_submission_status:
        'in_progress' | 'abandoned' | 'completed' | 'captured'
      github_app_installation_status: 'ACTIVE' | 'SUSPENDED' | 'REMOVED'
      integration_provider: 'VERCEL' | 'SUPABASE'
      invoice_status: 'DRAFT' | 'SENT' | 'VIEWED' | 'PAID' | 'VOID'
      lead_loss_reason:
        'BUDGET' | 'TIMING' | 'COMPETITOR' | 'FIT' | 'GHOSTED' | 'OTHER'
      lead_source_type: 'REFERRAL' | 'WEBSITE' | 'EVENT'
      lead_status:
        | 'NEW_OPPORTUNITIES'
        | 'ACTIVE_OPPORTUNITIES'
        | 'PROPOSAL_SENT'
        | 'ON_ICE'
        | 'CLOSED_WON'
        | 'CLOSED_LOST'
        | 'UNQUALIFIED'
      lead_update_type:
        'MEETING' | 'PHONE_CALL' | 'TEXT_MESSAGE' | 'EMAIL' | 'NOTE'
      oauth_connection_status:
        'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'PENDING_REAUTH'
      oauth_provider: 'GOOGLE' | 'GITHUB' | 'VERCEL' | 'SUPABASE'
      plan_thread_generation_status: 'idle' | 'streaming' | 'error'
      planning_session_status: 'active' | 'deployed'
      project_status: 'ONBOARDING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED'
      project_type: 'CLIENT' | 'PERSONAL' | 'INTERNAL'
      task_status: 'ON_DECK' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'
      user_role: 'ADMIN' | 'SALES' | 'CLIENT'
      worker_status:
        | 'dispatched'
        | 'working'
        | 'plan_ready'
        | 'implementing'
        | 'pr_created'
        | 'done_no_changes'
        | 'error'
        | 'cancelled'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_source: ['ADMIN_UI', 'CLI', 'MCP', 'SYSTEM'],
      client_billing_type: ['prepaid', 'net_30'],
      client_update_status: ['DRAFT', 'SENT'],
      form_submission_kind: ['audit', 'contact'],
      form_submission_status: [
        'in_progress',
        'abandoned',
        'completed',
        'captured',
      ],
      github_app_installation_status: ['ACTIVE', 'SUSPENDED', 'REMOVED'],
      integration_provider: ['VERCEL', 'SUPABASE'],
      invoice_status: ['DRAFT', 'SENT', 'VIEWED', 'PAID', 'VOID'],
      lead_loss_reason: [
        'BUDGET',
        'TIMING',
        'COMPETITOR',
        'FIT',
        'GHOSTED',
        'OTHER',
      ],
      lead_source_type: ['REFERRAL', 'WEBSITE', 'EVENT'],
      lead_status: [
        'NEW_OPPORTUNITIES',
        'ACTIVE_OPPORTUNITIES',
        'PROPOSAL_SENT',
        'ON_ICE',
        'CLOSED_WON',
        'CLOSED_LOST',
        'UNQUALIFIED',
      ],
      lead_update_type: [
        'MEETING',
        'PHONE_CALL',
        'TEXT_MESSAGE',
        'EMAIL',
        'NOTE',
      ],
      oauth_connection_status: [
        'ACTIVE',
        'EXPIRED',
        'REVOKED',
        'PENDING_REAUTH',
      ],
      oauth_provider: ['GOOGLE', 'GITHUB', 'VERCEL', 'SUPABASE'],
      plan_thread_generation_status: ['idle', 'streaming', 'error'],
      planning_session_status: ['active', 'deployed'],
      project_status: ['ONBOARDING', 'ACTIVE', 'ON_HOLD', 'COMPLETED'],
      project_type: ['CLIENT', 'PERSONAL', 'INTERNAL'],
      task_status: ['ON_DECK', 'IN_PROGRESS', 'BLOCKED', 'DONE'],
      user_role: ['ADMIN', 'SALES', 'CLIENT'],
      worker_status: [
        'dispatched',
        'working',
        'plan_ready',
        'implementing',
        'pr_created',
        'done_no_changes',
        'error',
        'cancelled',
      ],
    },
  },
} as const
