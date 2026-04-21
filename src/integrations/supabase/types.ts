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
      ad_campaigns: {
        Row: {
          budget: number
          company_id: string
          created_at: string
          cta_label: string | null
          ends_at: string
          id: string
          image_url: string | null
          kind: string
          link: string | null
          name: string
          priority: number
          starts_at: string
          status: string
          target_id: string | null
          target_type: string | null
          tenant_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          budget?: number
          company_id: string
          created_at?: string
          cta_label?: string | null
          ends_at?: string
          id?: string
          image_url?: string | null
          kind: string
          link?: string | null
          name: string
          priority?: number
          starts_at?: string
          status?: string
          target_id?: string | null
          target_type?: string | null
          tenant_id?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          budget?: number
          company_id?: string
          created_at?: string
          cta_label?: string | null
          ends_at?: string
          id?: string
          image_url?: string | null
          kind?: string
          link?: string | null
          name?: string
          priority?: number
          starts_at?: string
          status?: string
          target_id?: string | null
          target_type?: string | null
          tenant_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_contact_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_events: {
        Row: {
          campaign_id: string
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          slot_id: string | null
          viewer_id: string | null
        }
        Insert: {
          campaign_id: string
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          slot_id?: string | null
          viewer_id?: string | null
        }
        Update: {
          campaign_id?: string
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          slot_id?: string | null
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ads_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_events_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "ad_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_events_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "ads_public"
            referencedColumns: ["slot_id"]
          },
        ]
      }
      ad_placements: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          slot_id: string
          weight: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          slot_id: string
          weight?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          slot_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_placements_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_placements_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ads_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_placements_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "ad_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_placements_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "ads_public"
            referencedColumns: ["slot_id"]
          },
        ]
      }
      ad_slots: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          max_active: number
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          max_active?: number
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          max_active?: number
          name?: string
        }
        Relationships: []
      }
      arena_attendance: {
        Row: {
          arena_id: string
          check_in_method: string
          checked_in_at: string
          class_id: string
          created_at: string
          enrollment_id: string | null
          id: string
          recorded_by: string | null
          status: string
          student_id: string
          tenant_id: string | null
        }
        Insert: {
          arena_id: string
          check_in_method?: string
          checked_in_at?: string
          class_id: string
          created_at?: string
          enrollment_id?: string | null
          id?: string
          recorded_by?: string | null
          status?: string
          student_id: string
          tenant_id?: string | null
        }
        Update: {
          arena_id?: string
          check_in_method?: string
          checked_in_at?: string
          class_id?: string
          created_at?: string
          enrollment_id?: string | null
          id?: string
          recorded_by?: string | null
          status?: string
          student_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arena_attendance_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_attendance_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "arena_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_attendance_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "arena_class_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "arena_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_billing_cycles: {
        Row: {
          amount: number
          arena_id: string
          created_at: string
          due_at: string
          fee_amount: number | null
          gross_amount: number | null
          id: string
          net_amount: number | null
          paid_at: string | null
          payment_account_id: string | null
          payment_method: string | null
          payment_reference: string | null
          period_end: string
          period_start: string
          provider_preference_id: string | null
          status: string
          subscription_id: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          arena_id: string
          created_at?: string
          due_at: string
          fee_amount?: number | null
          gross_amount?: number | null
          id?: string
          net_amount?: number | null
          paid_at?: string | null
          payment_account_id?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          period_end: string
          period_start: string
          provider_preference_id?: string | null
          status?: string
          subscription_id: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          arena_id?: string
          created_at?: string
          due_at?: string
          fee_amount?: number | null
          gross_amount?: number | null
          id?: string
          net_amount?: number | null
          paid_at?: string | null
          payment_account_id?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          period_end?: string
          period_start?: string
          provider_preference_id?: string | null
          status?: string
          subscription_id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_billing_cycles_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_billing_cycles_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_billing_cycles_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "arena_student_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_billing_cycles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_checkin_tokens: {
        Row: {
          arena_id: string
          class_id: string
          created_at: string
          expires_at: string
          id: string
          tenant_id: string | null
          token: string
        }
        Insert: {
          arena_id: string
          class_id: string
          created_at?: string
          expires_at: string
          id?: string
          tenant_id?: string | null
          token: string
        }
        Update: {
          arena_id?: string
          class_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          tenant_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_checkin_tokens_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_checkin_tokens_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_checkin_tokens_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "arena_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_checkin_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_class_enrollments: {
        Row: {
          arena_id: string
          class_id: string
          created_at: string
          enrolled_at: string
          id: string
          payment_status: string
          status: string
          student_id: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          arena_id: string
          class_id: string
          created_at?: string
          enrolled_at?: string
          id?: string
          payment_status?: string
          status?: string
          student_id: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          arena_id?: string
          class_id?: string
          created_at?: string
          enrolled_at?: string
          id?: string
          payment_status?: string
          status?: string
          student_id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_class_enrollments_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_class_enrollments_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "arena_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_class_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "arena_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_class_enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_classes: {
        Row: {
          arena_id: string
          capacity: number
          court_id: string | null
          created_at: string
          description: string | null
          end_at: string
          id: string
          instructor_id: string | null
          level: string
          modality: string | null
          price: number | null
          recurrence: string
          start_at: string
          status: string
          tenant_id: string | null
          title: string
          updated_at: string
          weekday: number | null
        }
        Insert: {
          arena_id: string
          capacity?: number
          court_id?: string | null
          created_at?: string
          description?: string | null
          end_at: string
          id?: string
          instructor_id?: string | null
          level?: string
          modality?: string | null
          price?: number | null
          recurrence?: string
          start_at: string
          status?: string
          tenant_id?: string | null
          title: string
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          arena_id?: string
          capacity?: number
          court_id?: string | null
          created_at?: string
          description?: string | null
          end_at?: string
          id?: string
          instructor_id?: string | null
          level?: string
          modality?: string | null
          price?: number | null
          recurrence?: string
          start_at?: string
          status?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "arena_classes_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_classes_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_classes_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_classes_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "arena_instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_classes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_instructor_availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          instructor_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          instructor_id: string
          start_time: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          instructor_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "arena_instructor_availability_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "arena_instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_instructors: {
        Row: {
          arena_id: string
          bio: string | null
          created_at: string
          email: string | null
          full_name: string
          hourly_rate: number | null
          id: string
          phone: string | null
          profile_user_id: string | null
          specialties: string[]
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          arena_id: string
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          hourly_rate?: number | null
          id?: string
          phone?: string | null
          profile_user_id?: string | null
          specialties?: string[]
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          arena_id?: string
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          hourly_rate?: number | null
          id?: string
          phone?: string | null
          profile_user_id?: string | null
          specialties?: string[]
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_instructors_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_instructors_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_instructors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_links: {
        Row: {
          arena_id: string
          created_at: string
          icon_type: string
          id: string
          is_active: boolean
          position_order: number
          tenant_id: string | null
          title: string
          url: string
        }
        Insert: {
          arena_id: string
          created_at?: string
          icon_type?: string
          id?: string
          is_active?: boolean
          position_order?: number
          tenant_id?: string | null
          title: string
          url: string
        }
        Update: {
          arena_id?: string
          created_at?: string
          icon_type?: string
          id?: string
          is_active?: boolean
          position_order?: number
          tenant_id?: string | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_links_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_links_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas_public"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_membership_plans: {
        Row: {
          amount: number
          arena_id: string
          billing_frequency: string
          created_at: string
          currency: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          name: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          arena_id: string
          billing_frequency?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          name: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          arena_id?: string
          billing_frequency?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_membership_plans_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_membership_plans_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_membership_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_occurrences: {
        Row: {
          arena_id: string
          assigned_to: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          related_entity_id: string | null
          related_entity_type: string | null
          reported_by: string | null
          resolution_notes: string | null
          resolved_at: string | null
          severity: string
          status: string
          task_id: string | null
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          arena_id: string
          assigned_to?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          task_id?: string | null
          tenant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          arena_id?: string
          assigned_to?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          task_id?: string | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_occurrences_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_occurrences_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_occurrences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_operational_events: {
        Row: {
          archived_at: string | null
          arena_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          source: string
          tenant_id: string | null
        }
        Insert: {
          archived_at?: string | null
          arena_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          source?: string
          tenant_id?: string | null
        }
        Update: {
          archived_at?: string | null
          arena_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          source?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arena_operational_events_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_operational_events_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_operational_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_operational_tasks: {
        Row: {
          arena_id: string
          correlation_id: string | null
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          metadata: Json
          occurrence_id: string | null
          priority: number
          related_entity_id: string | null
          related_entity_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          source: string
          status: string
          task_type: string
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          arena_id: string
          correlation_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json
          occurrence_id?: string | null
          priority?: number
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          task_type: string
          tenant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          arena_id?: string
          correlation_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json
          occurrence_id?: string | null
          priority?: number
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          task_type?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_operational_tasks_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_operational_tasks_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_operational_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_partners: {
        Row: {
          arena_id: string
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean
          link_url: string | null
          logo_url: string | null
          name: string
          physical_space_included: boolean
          position_order: number
          tenant_id: string | null
          tier: string
        }
        Insert: {
          arena_id: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          link_url?: string | null
          logo_url?: string | null
          name: string
          physical_space_included?: boolean
          position_order?: number
          tenant_id?: string | null
          tier?: string
        }
        Update: {
          arena_id?: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          link_url?: string | null
          logo_url?: string | null
          name?: string
          physical_space_included?: boolean
          position_order?: number
          tenant_id?: string | null
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_partners_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_partners_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_partners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_partners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_contact_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_partners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_physical_inventory: {
        Row: {
          arena_id: string
          created_at: string
          description: string | null
          id: string
          is_available: boolean
          price_monthly: number | null
          space_type: string
          tenant_id: string | null
        }
        Insert: {
          arena_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_available?: boolean
          price_monthly?: number | null
          space_type?: string
          tenant_id?: string | null
        }
        Update: {
          arena_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_available?: boolean
          price_monthly?: number | null
          space_type?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arena_physical_inventory_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_physical_inventory_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas_public"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_student_subscriptions: {
        Row: {
          arena_id: string
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          metadata: Json
          next_due_at: string | null
          payment_account_id: string | null
          plan_id: string
          started_at: string
          status: string
          student_id: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          arena_id: string
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json
          next_due_at?: string | null
          payment_account_id?: string | null
          plan_id: string
          started_at?: string
          status?: string
          student_id: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          arena_id?: string
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json
          next_due_at?: string | null
          payment_account_id?: string | null
          plan_id?: string
          started_at?: string
          status?: string
          student_id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_student_subscriptions_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_student_subscriptions_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_student_subscriptions_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_student_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "arena_membership_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_student_subscriptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "arena_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_student_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_students: {
        Row: {
          arena_id: string
          birth_date: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          joined_at: string
          notes: string | null
          phone: string | null
          profile_user_id: string | null
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          arena_id: string
          birth_date?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          joined_at?: string
          notes?: string | null
          phone?: string | null
          profile_user_id?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          arena_id?: string
          birth_date?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          joined_at?: string
          notes?: string | null
          phone?: string | null
          profile_user_id?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_students_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_students_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_students_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      arenas: {
        Row: {
          address: string | null
          city: string
          contact_email: string | null
          contact_whatsapp: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          mp_collector_id: string | null
          mp_connected: boolean
          name: string
          owner_user_id: string
          rules: string | null
          slug: string
          state: string
          tenant_id: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string
          contact_email?: string | null
          contact_whatsapp?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          mp_collector_id?: string | null
          mp_connected?: boolean
          name: string
          owner_user_id: string
          rules?: string | null
          slug: string
          state?: string
          tenant_id?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string
          contact_email?: string | null
          contact_whatsapp?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          mp_collector_id?: string | null
          mp_connected?: boolean
          name?: string
          owner_user_id?: string
          rules?: string | null
          slug?: string
          state?: string
          tenant_id?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arenas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_activities: {
        Row: {
          activity_type: string
          arena_id: string | null
          athlete_id: string
          created_at: string
          id: string
          metadata: Json
          reference_id: string | null
          reference_type: string | null
          tenant_id: string | null
        }
        Insert: {
          activity_type: string
          arena_id?: string | null
          athlete_id: string
          created_at?: string
          id?: string
          metadata?: Json
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string | null
        }
        Update: {
          activity_type?: string
          arena_id?: string | null
          athlete_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      athlete_sponsors: {
        Row: {
          amount: number
          athlete_user_id: string
          company_id: string
          created_at: string
          end_date: string | null
          id: string
          start_date: string
        }
        Insert: {
          amount?: number
          athlete_user_id: string
          company_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          start_date: string
        }
        Update: {
          amount?: number
          athlete_user_id?: string
          company_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_sponsors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_sponsors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_contact_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_sponsors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          amount: number
          arena_id: string
          booking_date: string
          court_id: string
          created_at: string
          customer_email: string
          customer_name: string
          customer_whatsapp: string
          end_time: string
          id: string
          payment_provider: string | null
          payment_ref: string | null
          start_time: string
          status: string
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number
          arena_id: string
          booking_date: string
          court_id: string
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_whatsapp?: string
          end_time: string
          id?: string
          payment_provider?: string | null
          payment_ref?: string | null
          start_time: string
          status?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          arena_id?: string
          booking_date?: string
          court_id?: string
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_whatsapp?: string
          end_time?: string
          id?: string
          payment_provider?: string | null
          payment_ref?: string | null
          start_time?: string
          status?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      clips: {
        Row: {
          author_id: string
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_url: string
          tenant_id: string | null
          thumbnail_url: string | null
        }
        Insert: {
          author_id: string
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_url: string
          tenant_id?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          author_id?: string
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_url?: string
          tenant_id?: string | null
          thumbnail_url?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          billing_status: string
          category: string | null
          city: string | null
          cnpj: string | null
          commission_rate: number
          created_at: string
          description: string | null
          email: string | null
          feed_ads_enabled: boolean
          highlight_enabled: boolean
          id: string
          logo_url: string | null
          name: string
          owner_user_id: string
          phone: string | null
          plan: string
          plan_id: string | null
          state: string | null
          status: string
          tenant_id: string | null
          tournament_visibility: boolean
          updated_at: string
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          billing_status?: string
          category?: string | null
          city?: string | null
          cnpj?: string | null
          commission_rate?: number
          created_at?: string
          description?: string | null
          email?: string | null
          feed_ads_enabled?: boolean
          highlight_enabled?: boolean
          id?: string
          logo_url?: string | null
          name: string
          owner_user_id: string
          phone?: string | null
          plan?: string
          plan_id?: string | null
          state?: string | null
          status?: string
          tenant_id?: string | null
          tournament_visibility?: boolean
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          billing_status?: string
          category?: string | null
          city?: string | null
          cnpj?: string | null
          commission_rate?: number
          created_at?: string
          description?: string | null
          email?: string | null
          feed_ads_enabled?: boolean
          highlight_enabled?: boolean
          id?: string
          logo_url?: string | null
          name?: string
          owner_user_id?: string
          phone?: string | null
          plan?: string
          plan_id?: string | null
          state?: string | null
          status?: string
          tenant_id?: string | null
          tournament_visibility?: boolean
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "company_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      company_plans: {
        Row: {
          banner_feed_enabled: boolean
          commission_rate: number
          created_at: string
          description: string | null
          display_name: string
          id: string
          marketplace_highlight: boolean
          max_products: number | null
          monthly_price: number
          name: string
          sponsored_posts_per_month: number
          tournament_visibility: boolean
          updated_at: string
        }
        Insert: {
          banner_feed_enabled?: boolean
          commission_rate?: number
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          marketplace_highlight?: boolean
          max_products?: number | null
          monthly_price?: number
          name: string
          sponsored_posts_per_month?: number
          tournament_visibility?: boolean
          updated_at?: string
        }
        Update: {
          banner_feed_enabled?: boolean
          commission_rate?: number
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          marketplace_highlight?: boolean
          max_products?: number | null
          monthly_price?: number
          name?: string
          sponsored_posts_per_month?: number
          tournament_visibility?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      court_availability: {
        Row: {
          court_id: string
          created_at: string
          end_time: string
          id: string
          slot_duration_minutes: number
          start_time: string
          tenant_id: string | null
          weekday: number
        }
        Insert: {
          court_id: string
          created_at?: string
          end_time: string
          id?: string
          slot_duration_minutes?: number
          start_time: string
          tenant_id?: string | null
          weekday: number
        }
        Update: {
          court_id?: string
          created_at?: string
          end_time?: string
          id?: string
          slot_duration_minutes?: number
          start_time?: string
          tenant_id?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "court_availability_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      court_blocks: {
        Row: {
          block_date: string
          court_id: string
          created_at: string
          end_time: string | null
          id: string
          reason: string | null
          start_time: string | null
          tenant_id: string | null
        }
        Insert: {
          block_date: string
          court_id: string
          created_at?: string
          end_time?: string | null
          id?: string
          reason?: string | null
          start_time?: string | null
          tenant_id?: string | null
        }
        Update: {
          block_date?: string
          court_id?: string
          created_at?: string
          end_time?: string | null
          id?: string
          reason?: string | null
          start_time?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "court_blocks_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          arena_id: string
          created_at: string
          id: string
          is_active: boolean
          modalities: string[]
          name: string
          price_per_hour: number | null
          tenant_id: string | null
        }
        Insert: {
          arena_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          modalities?: string[]
          name?: string
          price_per_hour?: number | null
          tenant_id?: string | null
        }
        Update: {
          arena_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          modalities?: string[]
          name?: string
          price_per_hour?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courts_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courts_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas_public"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          amount_paid: number | null
          athlete_email: string | null
          athlete_name: string | null
          athlete_whatsapp: string | null
          checked_in_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          modality_id: string | null
          payer_id: string | null
          payment_id: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          tenant_id: string | null
          tournament_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_paid?: number | null
          athlete_email?: string | null
          athlete_name?: string | null
          athlete_whatsapp?: string | null
          checked_in_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          modality_id?: string | null
          payer_id?: string | null
          payment_id?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          tenant_id?: string | null
          tournament_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_paid?: number | null
          athlete_email?: string | null
          athlete_name?: string | null
          athlete_whatsapp?: string | null
          checked_in_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          modality_id?: string | null
          payer_id?: string | null
          payment_id?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          tenant_id?: string | null
          tournament_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_adjustments: {
        Row: {
          adjustment_type: string
          amount: number
          created_at: string
          created_by: string
          external_reference: string | null
          id: string
          metadata: Json
          reason: string
          tenant_id: string
          transaction_id: string
        }
        Insert: {
          adjustment_type: string
          amount: number
          created_at?: string
          created_by?: string
          external_reference?: string | null
          id?: string
          metadata?: Json
          reason: string
          tenant_id: string
          transaction_id: string
        }
        Update: {
          adjustment_type?: string
          amount?: number
          created_at?: string
          created_by?: string
          external_reference?: string | null
          id?: string
          metadata?: Json
          reason?: string
          tenant_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_adjustments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_ledger: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          mood_share: number
          source: string
          source_id: string | null
          tenant_id: string | null
        }
        Insert: {
          amount: number
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          mood_share?: number
          source: string
          source_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          mood_share?: number
          source?: string
          source_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_ledger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_contact_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          arena_id: string | null
          cancellation_reason: string | null
          created_at: string
          currency: string
          id: string
          metadata: Json
          organizer_id: string | null
          paid_at: string | null
          payment_provider: string | null
          payment_reference: string | null
          refunded_amount: number
          refunded_at: string | null
          source_id: string
          source_type: string
          status: string
          tenant_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          arena_id?: string | null
          cancellation_reason?: string | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          organizer_id?: string | null
          paid_at?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          refunded_amount?: number
          refunded_at?: string | null
          source_id: string
          source_type: string
          status?: string
          tenant_id: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          arena_id?: string | null
          cancellation_reason?: string | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          organizer_id?: string | null
          paid_at?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          refunded_amount?: number
          refunded_at?: string | null
          source_id?: string
          source_type?: string
          status?: string
          tenant_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      hashtag_searches: {
        Row: {
          created_at: string
          hashtag_id: string | null
          id: string
          searched_by: string | null
        }
        Insert: {
          created_at?: string
          hashtag_id?: string | null
          id?: string
          searched_by?: string | null
        }
        Update: {
          created_at?: string
          hashtag_id?: string | null
          id?: string
          searched_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hashtag_searches_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
        ]
      }
      hashtags: {
        Row: {
          created_at: string
          id: string
          tag: string
        }
        Insert: {
          created_at?: string
          id?: string
          tag: string
        }
        Update: {
          created_at?: string
          id?: string
          tag?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_orders: {
        Row: {
          buyer_confirmed: boolean | null
          buyer_user_id: string
          company_amount: number
          company_confirmed: boolean | null
          created_at: string
          id: string
          items: Json | null
          mood_commission: number
          payment_id: string | null
          payment_method: string | null
          product_id: string
          quantity: number
          shipping_cost: number | null
          shipping_zip: string | null
          status: string
          tenant_id: string | null
          total_amount: number
        }
        Insert: {
          buyer_confirmed?: boolean | null
          buyer_user_id: string
          company_amount?: number
          company_confirmed?: boolean | null
          created_at?: string
          id?: string
          items?: Json | null
          mood_commission?: number
          payment_id?: string | null
          payment_method?: string | null
          product_id: string
          quantity?: number
          shipping_cost?: number | null
          shipping_zip?: string | null
          status?: string
          tenant_id?: string | null
          total_amount: number
        }
        Update: {
          buyer_confirmed?: boolean | null
          buyer_user_id?: string
          company_amount?: number
          company_confirmed?: boolean | null
          created_at?: string
          id?: string
          items?: Json | null
          mood_commission?: number
          payment_id?: string | null
          payment_method?: string | null
          product_id?: string
          quantity?: number
          shipping_cost?: number | null
          shipping_zip?: string | null
          status?: string
          tenant_id?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      match_conversation_members: {
        Row: {
          conversation_id: string
          id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "match_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      match_conversations: {
        Row: {
          created_at: string
          id: string
          pair_id: string | null
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pair_id?: string | null
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pair_id?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_conversations_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "match_pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_conversations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      match_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "match_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      match_pair_members: {
        Row: {
          id: string
          pair_id: string
          user_id: string
        }
        Insert: {
          id?: string
          pair_id: string
          user_id: string
        }
        Update: {
          id?: string
          pair_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_pair_members_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "match_pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      match_pairs: {
        Row: {
          created_at: string
          id: string
          match_type: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_type?: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_type?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_pairs_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      match_requests: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          status: string
          to_user_id: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          status?: string
          to_user_id: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          status?: string
          to_user_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_requests_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      match_results: {
        Row: {
          created_at: string
          id: string
          match_number: number
          player1_id: string | null
          player2_id: string | null
          round: number
          score1: number | null
          score2: number | null
          tournament_id: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          match_number?: number
          player1_id?: string | null
          player2_id?: string | null
          round?: number
          score1?: number | null
          score2?: number | null
          tournament_id: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          match_number?: number
          player1_id?: string | null
          player2_id?: string | null
          round?: number
          score1?: number | null
          score2?: number | null
          tournament_id?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_results_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      mentions: {
        Row: {
          comment_id: string | null
          created_at: string | null
          id: string
          mentioned_user_id: string
          mentioner_id: string
          post_id: string | null
        }
        Insert: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          mentioned_user_id: string
          mentioner_id: string
          post_id?: string | null
        }
        Update: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          mentioned_user_id?: string
          mentioner_id?: string
          post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          read: boolean | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          read?: boolean | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          read?: boolean | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      modality_entries: {
        Row: {
          created_at: string
          id: string
          modality_id: string
          name: string
          seed: number | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          modality_id: string
          name?: string
          seed?: number | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          modality_id?: string
          name?: string
          seed?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modality_entries_modality_id_fkey"
            columns: ["modality_id"]
            isOneToOne: false
            referencedRelation: "tournament_modalities"
            referencedColumns: ["id"]
          },
        ]
      }
      modality_entry_members: {
        Row: {
          entry_id: string
          id: string
          user_id: string
        }
        Insert: {
          entry_id: string
          id?: string
          user_id: string
        }
        Update: {
          entry_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modality_entry_members_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "modality_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      modality_group_members: {
        Row: {
          entry_id: string
          group_id: string
          id: string
        }
        Insert: {
          entry_id: string
          group_id: string
          id?: string
        }
        Update: {
          entry_id?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modality_group_members_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "modality_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modality_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "modality_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      modality_groups: {
        Row: {
          group_name: string
          id: string
          modality_id: string
          tenant_id: string | null
        }
        Insert: {
          group_name?: string
          id?: string
          modality_id: string
          tenant_id?: string | null
        }
        Update: {
          group_name?: string
          id?: string
          modality_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modality_groups_modality_id_fkey"
            columns: ["modality_id"]
            isOneToOne: false
            referencedRelation: "tournament_modalities"
            referencedColumns: ["id"]
          },
        ]
      }
      modality_matches: {
        Row: {
          arena_id: string | null
          court_id: string | null
          created_at: string
          entry_a_id: string | null
          entry_b_id: string | null
          group_id: string | null
          id: string
          match_number: number
          modality_id: string
          round_number: number
          scheduled_at: string | null
          score_a: number | null
          score_b: number | null
          status: string
          tenant_id: string | null
          winner_entry_id: string | null
        }
        Insert: {
          arena_id?: string | null
          court_id?: string | null
          created_at?: string
          entry_a_id?: string | null
          entry_b_id?: string | null
          group_id?: string | null
          id?: string
          match_number?: number
          modality_id: string
          round_number?: number
          scheduled_at?: string | null
          score_a?: number | null
          score_b?: number | null
          status?: string
          tenant_id?: string | null
          winner_entry_id?: string | null
        }
        Update: {
          arena_id?: string | null
          court_id?: string | null
          created_at?: string
          entry_a_id?: string | null
          entry_b_id?: string | null
          group_id?: string | null
          id?: string
          match_number?: number
          modality_id?: string
          round_number?: number
          scheduled_at?: string | null
          score_a?: number | null
          score_b?: number | null
          status?: string
          tenant_id?: string | null
          winner_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modality_matches_entry_a_id_fkey"
            columns: ["entry_a_id"]
            isOneToOne: false
            referencedRelation: "modality_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modality_matches_entry_b_id_fkey"
            columns: ["entry_b_id"]
            isOneToOne: false
            referencedRelation: "modality_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modality_matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "modality_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modality_matches_modality_id_fkey"
            columns: ["modality_id"]
            isOneToOne: false
            referencedRelation: "tournament_modalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modality_matches_winner_entry_id_fkey"
            columns: ["winner_entry_id"]
            isOneToOne: false
            referencedRelation: "modality_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      modality_placements: {
        Row: {
          entry_id: string
          id: string
          modality_id: string
          position: number
          tenant_id: string | null
        }
        Insert: {
          entry_id: string
          id?: string
          modality_id: string
          position: number
          tenant_id?: string | null
        }
        Update: {
          entry_id?: string
          id?: string
          modality_id?: string
          position?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modality_placements_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "modality_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modality_placements_modality_id_fkey"
            columns: ["modality_id"]
            isOneToOne: false
            referencedRelation: "tournament_modalities"
            referencedColumns: ["id"]
          },
        ]
      }
      modality_prizes: {
        Row: {
          amount: number
          description: string | null
          id: string
          modality_id: string
          position: number
          tenant_id: string | null
        }
        Insert: {
          amount?: number
          description?: string | null
          id?: string
          modality_id: string
          position: number
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          description?: string | null
          id?: string
          modality_id?: string
          position?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modality_prizes_modality_id_fkey"
            columns: ["modality_id"]
            isOneToOne: false
            referencedRelation: "tournament_modalities"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_balances: {
        Row: {
          amount: number
          commission: number
          created_at: string
          id: string
          organizer_id: string
          payment_id: string | null
          status: string
          tenant_id: string | null
          tournament_id: string
          withdrawn_at: string | null
        }
        Insert: {
          amount?: number
          commission?: number
          created_at?: string
          id?: string
          organizer_id: string
          payment_id?: string | null
          status?: string
          tenant_id?: string | null
          tournament_id: string
          withdrawn_at?: string | null
        }
        Update: {
          amount?: number
          commission?: number
          created_at?: string
          id?: string
          organizer_id?: string
          payment_id?: string | null
          status?: string
          tenant_id?: string | null
          tournament_id?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizer_balances_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      orkym_action_executions: {
        Row: {
          attempt_number: number
          created_at: string
          duration_ms: number | null
          error_message: string | null
          executed_by: string | null
          id: string
          proposal_id: string
          result: Json | null
          status: string
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          executed_by?: string | null
          id?: string
          proposal_id: string
          result?: Json | null
          status: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          executed_by?: string | null
          id?: string
          proposal_id?: string
          result?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "orkym_action_executions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "orkym_action_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      orkym_action_proposals: {
        Row: {
          action_type: string
          approved_at: string | null
          approved_by: string | null
          arena_id: string | null
          correlation_id: string | null
          created_at: string
          description: string | null
          domain: string
          executed_at: string | null
          execution_result: Json | null
          expires_at: string
          failed_at: string | null
          failure_reason: string | null
          human_summary: Json
          id: string
          orkym_request_id: string | null
          priority: string
          proposed_payload: Json
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          source: string
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          action_type: string
          approved_at?: string | null
          approved_by?: string | null
          arena_id?: string | null
          correlation_id?: string | null
          created_at?: string
          description?: string | null
          domain: string
          executed_at?: string | null
          execution_result?: Json | null
          expires_at?: string
          failed_at?: string | null
          failure_reason?: string | null
          human_summary?: Json
          id?: string
          orkym_request_id?: string | null
          priority?: string
          proposed_payload?: Json
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          source?: string
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          approved_at?: string | null
          approved_by?: string | null
          arena_id?: string | null
          correlation_id?: string | null
          created_at?: string
          description?: string | null
          domain?: string
          executed_at?: string | null
          execution_result?: Json | null
          expires_at?: string
          failed_at?: string | null
          failure_reason?: string | null
          human_summary?: Json
          id?: string
          orkym_request_id?: string | null
          priority?: string
          proposed_payload?: Json
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          source?: string
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      orkym_api_calls: {
        Row: {
          action: string
          arena_id: string | null
          correlation_id: string | null
          created_at: string
          domain: string
          duration_ms: number | null
          error_message: string | null
          http_status: number | null
          id: string
          request_id: string
          request_summary: Json
          response_summary: Json
          retried_count: number
          status: string
          tenant_id: string | null
        }
        Insert: {
          action: string
          arena_id?: string | null
          correlation_id?: string | null
          created_at?: string
          domain: string
          duration_ms?: number | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          request_id: string
          request_summary?: Json
          response_summary?: Json
          retried_count?: number
          status: string
          tenant_id?: string | null
        }
        Update: {
          action?: string
          arena_id?: string | null
          correlation_id?: string | null
          created_at?: string
          domain?: string
          duration_ms?: number | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          request_id?: string
          request_summary?: Json
          response_summary?: Json
          retried_count?: number
          status?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      orkym_dedup: {
        Row: {
          created_at: string
          dedup_key: string
          expires_at: string
          id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          dedup_key: string
          expires_at: string
          id?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          dedup_key?: string
          expires_at?: string
          id?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      payment_accounts: {
        Row: {
          arena_id: string | null
          config: Json
          created_at: string
          external_id: string
          id: string
          provider: string
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          arena_id?: string | null
          config?: Json
          created_at?: string
          external_id: string
          id?: string
          provider?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          arena_id?: string | null
          config?: Json
          created_at?: string
          external_id?: string
          id?: string
          provider?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      post_hashtags: {
        Row: {
          hashtag_id: string
          id: string
          post_id: string
        }
        Insert: {
          hashtag_id: string
          id?: string
          post_id: string
        }
        Update: {
          hashtag_id?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_hashtags_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media: {
        Row: {
          created_at: string
          id: string
          media_url: string
          order_index: number
          post_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_url: string
          order_index?: number
          post_id: string
        }
        Update: {
          created_at?: string
          id?: string
          media_url?: string
          order_index?: number
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_saves: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          pinned_at: string | null
          tenant_id: string | null
          tournament_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          pinned_at?: string | null
          tenant_id?: string | null
          tournament_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          pinned_at?: string | null
          tenant_id?: string | null
          tournament_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          external_link: string | null
          featured: boolean
          id: string
          image_urls: string[]
          kind: string | null
          name: string
          price: number
          service_arena_id: string | null
          service_duration_minutes: number | null
          status: string
          stock: number | null
          tenant_id: string | null
          video_url: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          external_link?: string | null
          featured?: boolean
          id?: string
          image_urls?: string[]
          kind?: string | null
          name: string
          price: number
          service_arena_id?: string | null
          service_duration_minutes?: number | null
          status?: string
          stock?: number | null
          tenant_id?: string | null
          video_url?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          external_link?: string | null
          featured?: boolean
          id?: string
          image_urls?: string[]
          kind?: string | null
          name?: string
          price?: number
          service_arena_id?: string | null
          service_duration_minutes?: number | null
          status?: string
          stock?: number | null
          tenant_id?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_contact_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_highlights: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_highlights_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          arena: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string
          full_name: string
          gender: string | null
          id: string
          link: string | null
          mp_collector_id: string | null
          show_contact: boolean | null
          social_facebook: string | null
          social_instagram: string | null
          social_linkedin: string | null
          social_tiktok: string | null
          social_x: string | null
          social_youtube: string | null
          state: string | null
          team: string | null
          titles: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          arena?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          full_name?: string
          gender?: string | null
          id?: string
          link?: string | null
          mp_collector_id?: string | null
          show_contact?: boolean | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_tiktok?: string | null
          social_x?: string | null
          social_youtube?: string | null
          state?: string | null
          team?: string | null
          titles?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          arena?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          full_name?: string
          gender?: string | null
          id?: string
          link?: string | null
          mp_collector_id?: string | null
          show_contact?: boolean | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_tiktok?: string | null
          social_x?: string | null
          social_youtube?: string | null
          state?: string | null
          team?: string | null
          titles?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          resource_id: string | null
          resource_type: string
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      split_rules: {
        Row: {
          affiliate_pct: number
          arena_pct: number
          company_pct: number
          created_at: string
          id: string
          is_active: boolean
          organizer_pct: number
          platform_pct: number
          source_type: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          affiliate_pct?: number
          arena_pct?: number
          company_pct?: number
          created_at?: string
          id?: string
          is_active?: boolean
          organizer_pct?: number
          platform_pct?: number
          source_type: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          affiliate_pct?: number
          arena_pct?: number
          company_pct?: number
          created_at?: string
          id?: string
          is_active?: boolean
          organizer_pct?: number
          platform_pct?: number
          source_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sponsored_posts: {
        Row: {
          active: boolean
          active_from: string
          active_to: string
          city: string | null
          company_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          post_id: string | null
          title: string
        }
        Insert: {
          active?: boolean
          active_from: string
          active_to: string
          city?: string | null
          company_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          post_id?: string | null
          title: string
        }
        Update: {
          active?: boolean
          active_from?: string
          active_to?: string
          city?: string | null
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          post_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_posts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_posts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_contact_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_posts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsorship_giveaways: {
        Row: {
          admin_notes: string | null
          contact_email: string | null
          contact_name: string | null
          contact_whatsapp: string | null
          created_at: string
          delivery_address: string | null
          delivery_deadline: string | null
          id: string
          item_type: string
          needs_refrigeration: boolean | null
          notes: string | null
          pickup_address: string | null
          quantity: number
          rules: string | null
          sponsorship_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          delivery_address?: string | null
          delivery_deadline?: string | null
          id?: string
          item_type: string
          needs_refrigeration?: boolean | null
          notes?: string | null
          pickup_address?: string | null
          quantity?: number
          rules?: string | null
          sponsorship_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          delivery_address?: string | null
          delivery_deadline?: string | null
          id?: string
          item_type?: string
          needs_refrigeration?: boolean | null
          notes?: string | null
          pickup_address?: string | null
          quantity?: number
          rules?: string | null
          sponsorship_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsorship_giveaways_sponsorship_id_fkey"
            columns: ["sponsorship_id"]
            isOneToOne: false
            referencedRelation: "tournament_sponsorships"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          company_id: string
          created_at: string
          id: string
          next_billing_at: string | null
          plan_id: string
          started_at: string
          status: string
          tenant_id: string | null
        }
        Insert: {
          canceled_at?: string | null
          company_id: string
          created_at?: string
          id?: string
          next_billing_at?: string | null
          plan_id: string
          started_at?: string
          status?: string
          tenant_id?: string | null
        }
        Update: {
          canceled_at?: string | null
          company_id?: string
          created_at?: string
          id?: string
          next_billing_at?: string | null
          plan_id?: string
          started_at?: string
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_contact_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "company_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_primary: boolean
          kind: string
          tenant_id: string
          verification_status: string
          verification_token: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_primary?: boolean
          kind?: string
          tenant_id: string
          verification_status?: string
          verification_token?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_primary?: boolean
          kind?: string
          tenant_id?: string
          verification_status?: string
          verification_token?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_domains_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_memberships: {
        Row: {
          created_at: string
          id: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          created_at: string
          default_locale: string
          display_name: string
          favicon_url: string | null
          legal_name: string | null
          logo_url: string | null
          metadata: Json
          primary_color: string
          secondary_color: string
          status: string
          support_email: string | null
          support_phone: string | null
          tenant_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_locale?: string
          display_name: string
          favicon_url?: string | null
          legal_name?: string | null
          logo_url?: string | null
          metadata?: Json
          primary_color?: string
          secondary_color?: string
          status?: string
          support_email?: string | null
          support_phone?: string | null
          tenant_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_locale?: string
          display_name?: string
          favicon_url?: string | null
          legal_name?: string | null
          logo_url?: string | null
          metadata?: Json
          primary_color?: string
          secondary_color?: string
          status?: string
          support_email?: string | null
          support_phone?: string | null
          tenant_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          branding: Json
          created_at: string
          custom_domain: string | null
          id: string
          is_active: boolean
          name: string
          owner_user_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          branding?: Json
          created_at?: string
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          name: string
          owner_user_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          branding?: Json
          created_at?: string
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          name?: string
          owner_user_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      tournament_match_pool: {
        Row: {
          availability: string | null
          bio: string | null
          category: string
          created_at: string
          id: string
          level: string
          match_type: string
          position: string | null
          status: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          availability?: string | null
          bio?: string | null
          category?: string
          created_at?: string
          id?: string
          level?: string
          match_type?: string
          position?: string | null
          status?: string
          tournament_id: string
          user_id: string
        }
        Update: {
          availability?: string | null
          bio?: string | null
          category?: string
          created_at?: string
          id?: string
          level?: string
          match_type?: string
          position?: string | null
          status?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_match_pool_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_modalities: {
        Row: {
          bracket_format: string
          created_at: string
          gender: string | null
          id: string
          level: string | null
          max_entries: number | null
          name: string
          num_groups: number | null
          phase: string
          points_per_set: number | null
          rules_json: Json
          sets_to_win: number | null
          sport: string | null
          start_time: string | null
          status: string
          team_size: number
          tenant_id: string | null
          tournament_id: string
          type: string
        }
        Insert: {
          bracket_format?: string
          created_at?: string
          gender?: string | null
          id?: string
          level?: string | null
          max_entries?: number | null
          name: string
          num_groups?: number | null
          phase?: string
          points_per_set?: number | null
          rules_json?: Json
          sets_to_win?: number | null
          sport?: string | null
          start_time?: string | null
          status?: string
          team_size?: number
          tenant_id?: string | null
          tournament_id: string
          type?: string
        }
        Update: {
          bracket_format?: string
          created_at?: string
          gender?: string | null
          id?: string
          level?: string | null
          max_entries?: number | null
          name?: string
          num_groups?: number | null
          phase?: string
          points_per_set?: number | null
          rules_json?: Json
          sets_to_win?: number | null
          sport?: string | null
          start_time?: string | null
          status?: string
          team_size?: number
          tenant_id?: string | null
          tournament_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_modalities_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_partners: {
        Row: {
          company_id: string
          created_at: string
          id: string
          position_order: number
          tournament_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          position_order?: number
          tournament_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          position_order?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_partners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_partners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_contact_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_partners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_partners_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_sponsor_plans: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          display_name: string
          feed_visibility: boolean | null
          id: string
          max_tournaments: number | null
          name: string
          physical_banner_allowed: boolean | null
          price: number
          signup_visibility: boolean | null
          tournament_visibility: boolean | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          display_name: string
          feed_visibility?: boolean | null
          id?: string
          max_tournaments?: number | null
          name: string
          physical_banner_allowed?: boolean | null
          price?: number
          signup_visibility?: boolean | null
          tournament_visibility?: boolean | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          display_name?: string
          feed_visibility?: boolean | null
          id?: string
          max_tournaments?: number | null
          name?: string
          physical_banner_allowed?: boolean | null
          price?: number
          signup_visibility?: boolean | null
          tournament_visibility?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      tournament_sponsorships: {
        Row: {
          clicks_count: number
          company_id: string
          created_at: string
          id: string
          link: string | null
          logo_url: string | null
          message: string | null
          payment_id: string | null
          plan_id: string
          status: string
          tournament_id: string
          updated_at: string
          views_count: number
        }
        Insert: {
          clicks_count?: number
          company_id: string
          created_at?: string
          id?: string
          link?: string | null
          logo_url?: string | null
          message?: string | null
          payment_id?: string | null
          plan_id: string
          status?: string
          tournament_id: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          clicks_count?: number
          company_id?: string
          created_at?: string
          id?: string
          link?: string | null
          logo_url?: string | null
          message?: string | null
          payment_id?: string | null
          plan_id?: string
          status?: string
          tournament_id?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "tournament_sponsorships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_sponsorships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_contact_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_sponsorships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_sponsorships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tournament_sponsor_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_sponsorships_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          address: string | null
          address_complement: string | null
          address_number: string | null
          arena: string | null
          categories: string[] | null
          category: Database["public"]["Enums"]["tournament_category"]
          city: string
          created_at: string
          default_split_config: Json | null
          end_date: string
          entry_fee: number
          entry_fee_2: number | null
          entry_fee_3: number | null
          gender: string[] | null
          id: string
          image_url: string | null
          is_public: boolean
          match_enabled: boolean
          max_slots: number
          modality: string | null
          name: string
          organizer_id: string
          payment_deadline_days: number
          rules: string | null
          rules_file_url: string | null
          slot_config: Json | null
          start_date: string
          state: string
          tenant_id: string | null
          type: Database["public"]["Enums"]["tournament_type"]
          types: string[] | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          arena?: string | null
          categories?: string[] | null
          category?: Database["public"]["Enums"]["tournament_category"]
          city?: string
          created_at?: string
          default_split_config?: Json | null
          end_date: string
          entry_fee?: number
          entry_fee_2?: number | null
          entry_fee_3?: number | null
          gender?: string[] | null
          id?: string
          image_url?: string | null
          is_public?: boolean
          match_enabled?: boolean
          max_slots?: number
          modality?: string | null
          name: string
          organizer_id: string
          payment_deadline_days?: number
          rules?: string | null
          rules_file_url?: string | null
          slot_config?: Json | null
          start_date: string
          state?: string
          tenant_id?: string | null
          type?: Database["public"]["Enums"]["tournament_type"]
          types?: string[] | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          arena?: string | null
          categories?: string[] | null
          category?: Database["public"]["Enums"]["tournament_category"]
          city?: string
          created_at?: string
          default_split_config?: Json | null
          end_date?: string
          entry_fee?: number
          entry_fee_2?: number | null
          entry_fee_3?: number | null
          gender?: string[] | null
          id?: string
          image_url?: string | null
          is_public?: boolean
          match_enabled?: boolean
          max_slots?: number
          modality?: string | null
          name?: string
          organizer_id?: string
          payment_deadline_days?: number
          rules?: string | null
          rules_file_url?: string | null
          slot_config?: Json | null
          start_date?: string
          state?: string
          tenant_id?: string | null
          type?: Database["public"]["Enums"]["tournament_type"]
          types?: string[] | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      transaction_splits: {
        Row: {
          amount: number
          created_at: string
          expected_settlement_at: string | null
          id: string
          metadata: Json
          payment_account_id: string | null
          payout_reference: string | null
          percentage: number
          recipient_id: string | null
          recipient_type: string
          reversal_reason: string | null
          reversed_at: string | null
          settled_at: string | null
          settlement_method: string | null
          settlement_reference: string | null
          status: string
          tenant_id: string
          transaction_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expected_settlement_at?: string | null
          id?: string
          metadata?: Json
          payment_account_id?: string | null
          payout_reference?: string | null
          percentage: number
          recipient_id?: string | null
          recipient_type: string
          reversal_reason?: string | null
          reversed_at?: string | null
          settled_at?: string | null
          settlement_method?: string | null
          settlement_reference?: string | null
          status?: string
          tenant_id: string
          transaction_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expected_settlement_at?: string | null
          id?: string
          metadata?: Json
          payment_account_id?: string | null
          payout_reference?: string | null
          percentage?: number
          recipient_id?: string | null
          recipient_type?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          settled_at?: string | null
          settlement_method?: string | null
          settlement_reference?: string | null
          status?: string
          tenant_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_splits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          event_id: string
          id: string
          payload: Json | null
          processed_at: string | null
          provider: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          provider: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          provider?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          organizer_id: string
          pix_key: string
          processed_at: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          organizer_id: string
          pix_key: string
          processed_at?: string | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          organizer_id?: string
          pix_key?: string
          processed_at?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      ads_public: {
        Row: {
          company_logo: string | null
          company_name: string | null
          cta_label: string | null
          id: string | null
          image_url: string | null
          kind: string | null
          link: string | null
          priority: number | null
          slot_code: string | null
          slot_id: string | null
          target_id: string | null
          target_type: string | null
          title: string | null
        }
        Relationships: []
      }
      arenas_public: {
        Row: {
          city: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          rules: string | null
          slug: string | null
          state: string | null
          tenant_id: string | null
        }
        Insert: {
          city?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          rules?: string | null
          slug?: string | null
          state?: string | null
          tenant_id?: string | null
        }
        Update: {
          city?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          rules?: string | null
          slug?: string | null
          state?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arenas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_activities_public: {
        Row: {
          activity_type: string | null
          arena_id: string | null
          athlete_id: string | null
          created_at: string | null
          id: string | null
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          tenant_id: string | null
        }
        Insert: {
          activity_type?: string | null
          arena_id?: string | null
          athlete_id?: string | null
          created_at?: string | null
          id?: string | null
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string | null
        }
        Update: {
          activity_type?: string | null
          arena_id?: string | null
          athlete_id?: string | null
          created_at?: string | null
          id?: string | null
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      athletes_public: {
        Row: {
          attendances: number | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string | null
          full_name: string | null
          last_activity_at: string | null
          participations: number | null
          state: string | null
          team: string | null
          titles: string | null
          user_id: string | null
          wins: number | null
        }
        Relationships: []
      }
      companies_contact_public: {
        Row: {
          address: string | null
          category: string | null
          city: string | null
          created_at: string | null
          description: string | null
          email: string | null
          id: string | null
          logo_url: string | null
          name: string | null
          phone: string | null
          plan: string | null
          state: string | null
          status: string | null
          tenant_id: string | null
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          city?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          phone?: string | null
          plan?: string | null
          state?: string | null
          status?: string | null
          tenant_id?: string | null
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          city?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          phone?: string | null
          plan?: string | null
          state?: string | null
          status?: string | null
          tenant_id?: string | null
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      companies_public: {
        Row: {
          category: string | null
          city: string | null
          created_at: string | null
          description: string | null
          id: string | null
          logo_url: string | null
          name: string | null
          plan: string | null
          state: string | null
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          category?: string | null
          city?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          plan?: string | null
          state?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          category?: string | null
          city?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          plan?: string | null
          state?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      marketplace_public: {
        Row: {
          city: string | null
          company_id: string | null
          company_logo: string | null
          company_name: string | null
          created_at: string | null
          description: string | null
          featured: boolean | null
          id: string | null
          image_urls: string[] | null
          kind: string | null
          name: string | null
          price: number | null
          service_arena_id: string | null
          service_duration_minutes: number | null
          state: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_contact_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_public: {
        Row: {
          arena: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string | null
          full_name: string | null
          gender: string | null
          link: string | null
          social_facebook: string | null
          social_instagram: string | null
          social_linkedin: string | null
          social_tiktok: string | null
          social_x: string | null
          social_youtube: string | null
          state: string | null
          team: string | null
          titles: string | null
          user_id: string | null
        }
        Insert: {
          arena?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string | null
          full_name?: string | null
          gender?: string | null
          link?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_tiktok?: string | null
          social_x?: string | null
          social_youtube?: string | null
          state?: string | null
          team?: string | null
          titles?: string | null
          user_id?: string | null
        }
        Update: {
          arena?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string | null
          full_name?: string | null
          gender?: string | null
          link?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_tiktok?: string | null
          social_x?: string | null
          social_youtube?: string | null
          state?: string | null
          team?: string | null
          titles?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      social_feed_public: {
        Row: {
          actor_id: string | null
          arena_id: string | null
          created_at: string | null
          item_id: string | null
          item_type: string | null
          payload: Json | null
          tenant_id: string | null
        }
        Relationships: []
      }
      tenant_settings_public: {
        Row: {
          default_locale: string | null
          display_name: string | null
          favicon_url: string | null
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          tenant_id: string | null
          timezone: string | null
        }
        Insert: {
          default_locale?: string | null
          display_name?: string | null
          favicon_url?: string | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          tenant_id?: string | null
          timezone?: string | null
        }
        Update: {
          default_locale?: string | null
          display_name?: string | null
          favicon_url?: string | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          tenant_id?: string | null
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_organizer_balances_canonical: {
        Row: {
          gross_total: number | null
          organizer_id: string | null
          pending_total: number | null
          reversed_total: number | null
          settled_total: number | null
          split_count: number | null
          tenant_id: string | null
        }
        Relationships: []
      }
      v_orkym_action_metrics: {
        Row: {
          action_type: string | null
          approved_count: number | null
          avg_execution_ms: number | null
          avg_time_to_approval_ms: number | null
          day: string | null
          domain: string | null
          executed_count: number | null
          expired_count: number | null
          failed_count: number | null
          proposed_count: number | null
          rejected_count: number | null
          tenant_id: string | null
          total_count: number | null
        }
        Relationships: []
      }
      v_orkym_metrics: {
        Row: {
          action: string | null
          avg_duration_ms_success: number | null
          day: string | null
          deduped: number | null
          degraded: number | null
          domain: string | null
          failed: number | null
          rate_limited: number | null
          success: number | null
          tenant_id: string | null
          timeouts: number | null
          total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      ad_record_event: {
        Args: { _campaign_id: string; _event_type: string; _slot_id: string }
        Returns: string
      }
      arena_archive_old_events: {
        Args: { _arena_id: string; _older_than_days?: number }
        Returns: number
      }
      arena_checkin_validate: { Args: { _token: string }; Returns: Json }
      arena_generate_billing_cycle: {
        Args: { _subscription_id: string }
        Returns: string
      }
      arena_mark_cycle_paid:
        | {
            Args: {
              _cycle_id: string
              _payment_method?: string
              _payment_reference?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _cycle_id: string
              _fee_amount?: number
              _payment_method?: string
              _payment_reference?: string
            }
            Returns: undefined
          }
      arena_mark_overdue_cycles: {
        Args: { _arena_id: string }
        Returns: number
      }
      create_organizer_tenant: {
        Args: { _display_name?: string; _name: string; _slug: string }
        Returns: string
      }
      current_tenant_id: { Args: never; Returns: string }
      expire_pending_enrollments: { Args: never; Returns: number }
      finance_apply_split_override: {
        Args: { _reason: string; _splits: Json; _transaction_id: string }
        Returns: string
      }
      finance_cancel_transaction: {
        Args: { _reason: string; _transaction_id: string }
        Returns: undefined
      }
      finance_compute_expected_settlement: {
        Args: { _paid_at: string; _tenant_id: string }
        Returns: string
      }
      finance_mark_split_settled:
        | {
            Args: { _reference?: string; _split_id: string }
            Returns: undefined
          }
        | {
            Args: { _method?: string; _reference?: string; _split_id: string }
            Returns: undefined
          }
      finance_record_payment: {
        Args: {
          _paid_at?: string
          _provider?: string
          _reference?: string
          _source_id: string
          _source_type: string
          _total: number
        }
        Returns: string
      }
      finance_record_refund: {
        Args: {
          _amount: number
          _external_ref?: string
          _reason: string
          _transaction_id: string
        }
        Returns: string
      }
      get_arena_id_from_court: { Args: { _court_id: string }; Returns: string }
      get_arena_id_from_instructor: {
        Args: { _instructor_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_arena_owner: {
        Args: { _arena_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_owner: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_match_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_modality_tournament_owner: {
        Args: { _modality_id: string; _user_id: string }
        Returns: boolean
      }
      is_pair_member: {
        Args: { _pair_id: string; _user_id: string }
        Returns: boolean
      }
      is_sponsorship_company_owner: {
        Args: { _sponsorship_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_tournament_owner: {
        Args: { _tournament_id: string; _user_id: string }
        Returns: boolean
      }
      orkym_action_approve: {
        Args: { _proposal_id: string }
        Returns: {
          action_type: string
          approved_at: string | null
          approved_by: string | null
          arena_id: string | null
          correlation_id: string | null
          created_at: string
          description: string | null
          domain: string
          executed_at: string | null
          execution_result: Json | null
          expires_at: string
          failed_at: string | null
          failure_reason: string | null
          human_summary: Json
          id: string
          orkym_request_id: string | null
          priority: string
          proposed_payload: Json
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          source: string
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orkym_action_proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      orkym_action_expire_stale: { Args: never; Returns: number }
      orkym_action_mark_executed: {
        Args: {
          _duration_ms?: number
          _executed_by: string
          _proposal_id: string
          _result: Json
        }
        Returns: undefined
      }
      orkym_action_mark_executing: {
        Args: { _proposal_id: string }
        Returns: boolean
      }
      orkym_action_mark_failed: {
        Args: {
          _duration_ms?: number
          _executed_by: string
          _proposal_id: string
          _reason: string
        }
        Returns: undefined
      }
      orkym_action_reject: {
        Args: { _proposal_id: string; _reason: string }
        Returns: {
          action_type: string
          approved_at: string | null
          approved_by: string | null
          arena_id: string | null
          correlation_id: string | null
          created_at: string
          description: string | null
          domain: string
          executed_at: string | null
          execution_result: Json | null
          expires_at: string
          failed_at: string | null
          failure_reason: string | null
          human_summary: Json
          id: string
          orkym_request_id: string | null
          priority: string
          proposed_payload: Json
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          source: string
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orkym_action_proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      orkym_ingest_actions: { Args: { _payload: Json }; Returns: number }
      orkym_ingest_tasks: { Args: { _payload: Json }; Returns: number }
      orkym_purge_dedup: { Args: never; Returns: number }
      resolve_tenant_by_host: { Args: { _host: string }; Returns: string }
      search_global: { Args: { _term: string }; Returns: Json }
      set_current_tenant: { Args: { _tenant_id: string }; Returns: undefined }
      set_tenant_from_user: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role: "organizer" | "athlete" | "admin" | "arena" | "company"
      enrollment_status: "pending" | "paid" | "expired"
      tournament_category: "masculino" | "feminino" | "misto"
      tournament_type: "individual" | "duplas" | "equipes"
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
      app_role: ["organizer", "athlete", "admin", "arena", "company"],
      enrollment_status: ["pending", "paid", "expired"],
      tournament_category: ["masculino", "feminino", "misto"],
      tournament_type: ["individual", "duplas", "equipes"],
    },
  },
} as const
