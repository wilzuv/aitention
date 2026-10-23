export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
          user_id?: string
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          created_at: string
          duration_minutes: number | null
          ended_at: string | null
          enjoyment_rating: number | null
          entry_date: string
          id: string
          post_session_notes: string | null
          pre_session_notes: string | null
          source: string
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          enjoyment_rating?: number | null
          entry_date: string
          id?: string
          post_session_notes?: string | null
          pre_session_notes?: string | null
          source?: string
          started_at: string
          user_id?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          enjoyment_rating?: number | null
          entry_date?: string
          id?: string
          post_session_notes?: string | null
          pre_session_notes?: string | null
          source?: string
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      foundations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goal_logs: {
        Row: {
          from_status: string | null
          goal_id: string
          id: string
          kind: string
          logged_at: string
          note: string | null
          to_status: string | null
          user_id: string
        }
        Insert: {
          from_status?: string | null
          goal_id: string
          id?: string
          kind?: string
          logged_at?: string
          note?: string | null
          to_status?: string | null
          user_id?: string
        }
        Update: {
          from_status?: string | null
          goal_id?: string
          id?: string
          kind?: string
          logged_at?: string
          note?: string | null
          to_status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_logs_goal_id_fkey"
            columns: ["goal_id","user_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id","user_id"]
          },
        ]
      }
      goals: {
        Row: {
          closed_at: string | null
          created_at: string
          foundation_id: string | null
          id: string
          milestone_id: string | null
          notes: string | null
          parent_goal_id: string | null
          project_id: string | null
          review_date: string | null
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          foundation_id?: string | null
          id?: string
          milestone_id?: string | null
          notes?: string | null
          parent_goal_id?: string | null
          project_id?: string | null
          review_date?: string | null
          status?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          foundation_id?: string | null
          id?: string
          milestone_id?: string | null
          notes?: string | null
          parent_goal_id?: string | null
          project_id?: string | null
          review_date?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_foundation_id_fkey"
            columns: ["foundation_id","user_id"]
            isOneToOne: false
            referencedRelation: "foundations"
            referencedColumns: ["id","user_id"]
          },
          {
            foreignKeyName: "goals_parent_goal_id_fkey"
            columns: ["parent_goal_id","user_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id","user_id"]
          },
          {
            foreignKeyName: "goals_project_id_fkey"
            columns: ["project_id","user_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id","user_id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          content: string
          created_at: string | null
          entry_date: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string | null
          entry_date: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string | null
          entry_date?: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      linear_tickets: {
        Row: {
          created_at: string
          id: string
          identifier: string
          metadata_synced_at: string | null
          status: string | null
          team_key: string
          title: string | null
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
          metadata_synced_at?: string | null
          status?: string | null
          team_key: string
          title?: string | null
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          metadata_synced_at?: string | null
          status?: string | null
          team_key?: string
          title?: string | null
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mcp_tokens: {
        Row: {
          created_at: string
          id: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          token_hash: string
          token_prefix: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
          user_id?: string
        }
        Relationships: []
      }
      mood_logs: {
        Row: {
          context: string
          created_at: string
          energy_rating: number | null
          id: string
          logged_at: string
          mood_rating: number | null
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context?: string
          created_at?: string
          energy_rating?: number | null
          id?: string
          logged_at?: string
          mood_rating?: number | null
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          context?: string
          created_at?: string
          energy_rating?: number | null
          id?: string
          logged_at?: string
          mood_rating?: number | null
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oura_daily_records: {
        Row: {
          date: string
          id: string
          raw: Json | null
          readiness_score: number | null
          sleep_hours: number | null
          sleep_score: number | null
          steps: number | null
          synced_at: string | null
          user_id: string
        }
        Insert: {
          date: string
          id?: string
          raw?: Json | null
          readiness_score?: number | null
          sleep_hours?: number | null
          sleep_score?: number | null
          steps?: number | null
          synced_at?: string | null
          user_id?: string
        }
        Update: {
          date?: string
          id?: string
          raw?: Json | null
          readiness_score?: number | null
          sleep_hours?: number | null
          sleep_score?: number | null
          steps?: number | null
          synced_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      predictions: {
        Row: {
          confidence: number
          created_at: string
          hypothesis_id: string | null
          id: string
          milestone_id: string | null
          outcome: string | null
          prediction: string
          project_id: string | null
          reasoning: string | null
          resolution: string | null
          resolution_date: string
          resolved_at: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence: number
          created_at?: string
          hypothesis_id?: string | null
          id?: string
          milestone_id?: string | null
          outcome?: string | null
          prediction: string
          project_id?: string | null
          reasoning?: string | null
          resolution?: string | null
          resolution_date: string
          resolved_at?: string | null
          source: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          hypothesis_id?: string | null
          id?: string
          milestone_id?: string | null
          outcome?: string | null
          prediction?: string
          project_id?: string | null
          reasoning?: string | null
          resolution?: string | null
          resolution_date?: string
          resolved_at?: string | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_hypothesis_id_fkey"
            columns: ["hypothesis_id","user_id"]
            isOneToOne: false
            referencedRelation: "hypotheses"
            referencedColumns: ["id","user_id"]
          },
          {
            foreignKeyName: "predictions_project_id_fkey"
            columns: ["project_id","user_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id","user_id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          project_id: string
          sort_order: number
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          sort_order?: number
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id","user_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id","user_id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurrence_completions: {
        Row: {
          completed_at: string
          created_at: string
          id: string
          scheduled_for: string
          task_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          id?: string
          scheduled_for: string
          task_id: string
          user_id?: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          id?: string
          scheduled_for?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrence_completions_task_id_fkey"
            columns: ["task_id","user_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id","user_id"]
          },
        ]
      }
      session_tasks: {
        Row: {
          id: string
          is_primary: boolean
          linked_when: string
          session_id: string
          task_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_primary?: boolean
          linked_when: string
          session_id: string
          task_id: string
          user_id?: string
        }
        Update: {
          id?: string
          is_primary?: boolean
          linked_when?: string
          session_id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_tasks_session_id_fkey"
            columns: ["session_id","user_id"]
            isOneToOne: false
            referencedRelation: "focus_sessions"
            referencedColumns: ["id","user_id"]
          },
          {
            foreignKeyName: "session_tasks_task_id_fkey"
            columns: ["task_id","user_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id","user_id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_minutes: number | null
          completed_at: string | null
          created_at: string | null
          discarded_at: string | null
          due_date: string | null
          estimated_minutes: number | null
          goal_id: string | null
          id: string
          linear_ticket_id: string | null
          milestone_id: string | null
          notes: string | null
          position: number
          project_id: string | null
          recurrence_rule: Json | null
          reflection: string | null
          schedule_history: Json | null
          scheduled_date: string
          status: string
          success_criteria: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actual_minutes?: number | null
          completed_at?: string | null
          created_at?: string | null
          discarded_at?: string | null
          due_date?: string | null
          estimated_minutes?: number | null
          goal_id?: string | null
          id?: string
          linear_ticket_id?: string | null
          milestone_id?: string | null
          notes?: string | null
          position?: number
          project_id?: string | null
          recurrence_rule?: Json | null
          reflection?: string | null
          schedule_history?: Json | null
          scheduled_date: string
          status?: string
          success_criteria?: string | null
          title: string
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          actual_minutes?: number | null
          completed_at?: string | null
          created_at?: string | null
          discarded_at?: string | null
          due_date?: string | null
          estimated_minutes?: number | null
          goal_id?: string | null
          id?: string
          linear_ticket_id?: string | null
          milestone_id?: string | null
          notes?: string | null
          position?: number
          project_id?: string | null
          recurrence_rule?: Json | null
          reflection?: string | null
          schedule_history?: Json | null
          scheduled_date?: string
          status?: string
          success_criteria?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_goal_id_fkey"
            columns: ["goal_id","user_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id","user_id"]
          },
          {
            foreignKeyName: "tasks_linear_ticket_id_fkey"
            columns: ["linear_ticket_id","user_id"]
            isOneToOne: false
            referencedRelation: "linear_tickets"
            referencedColumns: ["id","user_id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id","user_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id","user_id"]
          },
        ]
      }
      user_integrations: {
        Row: {
          access_token: string
          connected_at: string | null
          id: string
          provider: string
          refresh_token: string | null
          token_expires_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          connected_at?: string | null
          id?: string
          provider: string
          refresh_token?: string | null
          token_expires_at?: string | null
          user_id?: string
        }
        Update: {
          access_token?: string
          connected_at?: string | null
          id?: string
          provider?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_actual_minutes: {
        Args: { add_minutes: number; task_id: string }
        Returns: undefined
      }
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
  public: {
    Enums: {},
  },
} as const
