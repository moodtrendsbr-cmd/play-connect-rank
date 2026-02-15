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
          thumbnail_url: string | null
        }
        Insert: {
          author_id: string
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_url: string
          thumbnail_url?: string | null
        }
        Update: {
          author_id?: string
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_url?: string
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
          category: string | null
          city: string | null
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
          state: string | null
          status: string
          tournament_visibility: boolean
          updated_at: string
        }
        Insert: {
          category?: string | null
          city?: string | null
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
          state?: string | null
          status?: string
          tournament_visibility?: boolean
          updated_at?: string
        }
        Update: {
          category?: string | null
          city?: string | null
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
          state?: string | null
          status?: string
          tournament_visibility?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          athlete_email: string | null
          athlete_name: string | null
          athlete_whatsapp: string | null
          created_at: string
          expires_at: string | null
          id: string
          payer_id: string | null
          payment_id: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          tournament_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          athlete_email?: string | null
          athlete_name?: string | null
          athlete_whatsapp?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          payer_id?: string | null
          payment_id?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          tournament_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          athlete_email?: string | null
          athlete_name?: string | null
          athlete_whatsapp?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          payer_id?: string | null
          payment_id?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
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
          buyer_user_id: string
          company_amount: number
          created_at: string
          id: string
          mood_commission: number
          product_id: string
          quantity: number
          status: string
          total_amount: number
        }
        Insert: {
          buyer_user_id: string
          company_amount?: number
          created_at?: string
          id?: string
          mood_commission?: number
          product_id: string
          quantity?: number
          status?: string
          total_amount: number
        }
        Update: {
          buyer_user_id?: string
          company_amount?: number
          created_at?: string
          id?: string
          mood_commission?: number
          product_id?: string
          quantity?: number
          status?: string
          total_amount?: number
        }
        Relationships: [
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
      organizer_balances: {
        Row: {
          amount: number
          commission: number
          created_at: string
          id: string
          organizer_id: string
          payment_id: string | null
          status: string
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
          name: string
          price: number
          status: string
          stock: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          external_link?: string | null
          featured?: boolean
          id?: string
          image_urls?: string[]
          name: string
          price: number
          status?: string
          stock?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          external_link?: string | null
          featured?: boolean
          id?: string
          image_urls?: string[]
          name?: string
          price?: number
          status?: string
          stock?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string
          full_name: string
          id: string
          link: string | null
          mp_collector_id: string | null
          show_contact: boolean | null
          state: string | null
          team: string | null
          titles: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          full_name?: string
          id?: string
          link?: string | null
          mp_collector_id?: string | null
          show_contact?: boolean | null
          state?: string | null
          team?: string | null
          titles?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          full_name?: string
          id?: string
          link?: string | null
          mp_collector_id?: string | null
          show_contact?: boolean | null
          state?: string | null
          team?: string | null
          titles?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
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
            foreignKeyName: "sponsored_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "tournament_partners_tournament_id_fkey"
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
          category: Database["public"]["Enums"]["tournament_category"]
          city: string
          created_at: string
          end_date: string
          entry_fee: number
          id: string
          image_url: string | null
          is_public: boolean
          match_enabled: boolean
          max_slots: number
          name: string
          organizer_id: string
          payment_deadline_days: number
          rules: string | null
          start_date: string
          state: string
          type: Database["public"]["Enums"]["tournament_type"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          category?: Database["public"]["Enums"]["tournament_category"]
          city?: string
          created_at?: string
          end_date: string
          entry_fee?: number
          id?: string
          image_url?: string | null
          is_public?: boolean
          match_enabled?: boolean
          max_slots?: number
          name: string
          organizer_id: string
          payment_deadline_days?: number
          rules?: string | null
          start_date: string
          state?: string
          type?: Database["public"]["Enums"]["tournament_type"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: Database["public"]["Enums"]["tournament_category"]
          city?: string
          created_at?: string
          end_date?: string
          entry_fee?: number
          id?: string
          image_url?: string | null
          is_public?: boolean
          match_enabled?: boolean
          max_slots?: number
          name?: string
          organizer_id?: string
          payment_deadline_days?: number
          rules?: string | null
          start_date?: string
          state?: string
          type?: Database["public"]["Enums"]["tournament_type"]
          updated_at?: string
        }
        Relationships: []
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
      withdrawal_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          organizer_id: string
          pix_key: string
          processed_at: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          organizer_id: string
          pix_key: string
          processed_at?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          organizer_id?: string
          pix_key?: string
          processed_at?: string | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_company_owner: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_match_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_pair_member: {
        Args: { _pair_id: string; _user_id: string }
        Returns: boolean
      }
      is_tournament_owner: {
        Args: { _tournament_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "organizer" | "athlete" | "admin"
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
      app_role: ["organizer", "athlete", "admin"],
      enrollment_status: ["pending", "paid", "expired"],
      tournament_category: ["masculino", "feminino", "misto"],
      tournament_type: ["individual", "duplas", "equipes"],
    },
  },
} as const
