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
      clothing_items: {
        Row: {
          description: string | null
          gender: Database["public"]["Enums"]["gender_type"]
          id: string
          name: string
          price: number
        }
        Insert: {
          description?: string | null
          gender: Database["public"]["Enums"]["gender_type"]
          id?: string
          name: string
          price: number
        }
        Update: {
          description?: string | null
          gender?: Database["public"]["Enums"]["gender_type"]
          id?: string
          name?: string
          price?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          clothing_item_id: string
          id: string
          order_id: string
          price: number
          quantity: number
        }
        Insert: {
          clothing_item_id: string
          id?: string
          order_id: string
          price: number
          quantity: number
        }
        Update: {
          clothing_item_id?: string
          id?: string
          order_id?: string
          price?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_clothing_item_id_fkey"
            columns: ["clothing_item_id"]
            isOneToOne: false
            referencedRelation: "clothing_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          delivery_date: string | null
          id: string
          notes: string | null
          pickup_date: string
          status: Database["public"]["Enums"]["order_status"]
          student_id: string
          total_price: number
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          created_at?: string
          delivery_date?: string | null
          id?: string
          notes?: string | null
          pickup_date?: string
          status?: Database["public"]["Enums"]["order_status"]
          student_id: string
          total_price: number
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          created_at?: string
          delivery_date?: string | null
          id?: string
          notes?: string | null
          pickup_date?: string
          status?: Database["public"]["Enums"]["order_status"]
          student_id?: string
          total_price?: number
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          assigned_hostel: string | null
          created_at: string
          email: string
          floor: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender_type"]
          hostel: string | null
          id: string
          registration_number: string | null
          role: string
          worker_id: string | null
        }
        Insert: {
          assigned_hostel?: string | null
          created_at?: string
          email: string
          floor?: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender_type"]
          hostel?: string | null
          id: string
          registration_number?: string | null
          role: string
          worker_id?: string | null
        }
        Update: {
          assigned_hostel?: string | null
          created_at?: string
          email?: string
          floor?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["gender_type"]
          hostel?: string | null
          id?: string
          registration_number?: string | null
          role?: string
          worker_id?: string | null
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
      gender_type: "male" | "female" | "other"
      order_status:
        | "pending"
        | "accepted"
        | "processing"
        | "completed"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
