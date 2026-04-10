// Auto-generated from Supabase schema. Do not edit by hand.
// Regenerate with: mcp__5a879668...__generate_typescript_types
// Or: supabase gen types typescript --project-id gxiflulfgqahlvdirecz

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
      availability: {
        Row: {
          auth_id: string | null
          county: string
          created_at: string
          player_id: string
          slots: Json
          updated_at: string
          weekly_cap: number
        }
      }
      lobby: {
        Row: {
          auth_id: string | null
          county: string
          joined_at: string
          player_id: string
          player_name: string
        }
      }
      players: {
        Row: {
          auth_id: string | null
          county: string
          created_at: string
          email: string | null
          experience_level: string | null
          player_id: string
          player_name: string
          sex: string | null
          weekly_cap: number | null
        }
      }
      tournaments: {
        Row: {
          county: string
          data: Json
          id: string
          updated_at: string
        }
      }
      ratings: {
        Row: {
          auth_id: string | null
          data: Json
          player_id: string
          updated_at: string
        }
      }
      rating_history: {
        Row: {
          auth_id: string | null
          id: string
          player_id: string
          rating: number
          recorded_at: string
        }
      }
      trophies: {
        Row: {
          auth_id: string | null
          awarded_at: string
          county: string
          date: string
          final_match: Json | null
          id: string
          player_id: string
          player_name: string
          tier: string
          tournament_id: string
          tournament_name: string
        }
      }
      badges: {
        Row: {
          auth_id: string | null
          awarded_at: string
          badge_type: string
          description: string
          id: string
          label: string
          player_id: string
          tournament_id: string | null
        }
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
      }
    }
    Functions: {
      rpc_submit_score: {
        Args: {
          p_match_id: string
          p_score1: Json
          p_score2: Json
          p_tournament_id: string
          p_winner_id: string
        }
        Returns: Json
      }
      rpc_confirm_score: {
        Args: {
          p_confirming_player_id: string
          p_match_id: string
          p_tournament_id: string
        }
        Returns: Json
      }
      rpc_forfeit_player: {
        Args: { p_player_id: string; p_tournament_id: string }
        Returns: Json
      }
      rpc_join_friend_tournament: {
        Args: {
          p_invite_code: string
          p_player_id: string
          p_player_name: string
        }
        Returns: Json
      }
      rpc_start_tournament_from_lobby: {
        Args: {
          p_county: string
          p_max_players?: number
          p_min_players?: number
        }
        Returns: Json
      }
      validate_tennis_score: {
        Args: {
          p_player1_id: string
          p_player2_id: string
          p_score1: Json
          p_score2: Json
          p_winner_id: string
        }
        Returns: Json
      }
    }
  }
}
