export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          company_name: string | null
          address: string | null
          company_type: string | null
          status: string | null
          financing_type: string[] | null
          incorporation_date: string | null
          amount_required: string | null
          has_brief: boolean
          has_financials: boolean
          selected_ods: string[] | null
          brief_file_name: string | null
          financials_file_name: string | null
          brief_file_base64: string | null
          brief_mime_type: string | null
          financials_file_base64: string | null
          financials_mime_type: string | null
          financial_metrics: Json | null
          ai_generated_summary: string | null
          user_type: string
          created_at: string
          updated_at: string
            }
            Relationships: []
        Insert: {
          id?: string
          user_id: string
          company_name?: string | null
          address?: string | null
          company_type?: string | null
          status?: string | null
          financing_type?: string[] | null
          incorporation_date?: string | null
          amount_required?: string | null
          has_brief?: boolean
          has_financials?: boolean
          selected_ods?: string[] | null
          brief_file_name?: string | null
          financials_file_name?: string | null
          brief_file_base64?: string | null
          brief_mime_type?: string | null
          financials_file_base64?: string | null
          financials_mime_type?: string | null
          financial_metrics?: Json | null
          ai_generated_summary?: string | null
          user_type?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_name?: string | null
          address?: string | null
          company_type?: string | null
          status?: string | null
          financing_type?: string[] | null
          incorporation_date?: string | null
          amount_required?: string | null
          has_brief?: boolean
          has_financials?: boolean
          selected_ods?: string[] | null
          brief_file_name?: string | null
          financials_file_name?: string | null
          brief_file_base64?: string | null
          brief_mime_type?: string | null
          financials_file_base64?: string | null
          financials_mime_type?: string | null
          financial_metrics?: Json | null
          ai_generated_summary?: string | null
          user_type?: string
          created_at?: string
          updated_at?: string
        }
      }
      funds: {
        Row: {
          id: string
          user_id: string
          nombre_fondo: string
          gestor_activos: string
          ticker_isin: string
          url_fuente: string
          fecha_scrapeo: string
          ods_encontrados: string[]
          keywords_encontradas: string[]
          puntuacion_impacto: string
          evidencia_texto: string
          es_elegible: string | null
          resumen_requisitos: string[] | null
          pasos_aplicacion: string[] | null
          fechas_clave: string | null
          link_directo_aplicacion: string | null
          contact_emails: string[] | null
          application_status: string | null
          created_at: string
          updated_at: string
        }
        Relationships: []
        Insert: {
          id?: string
          user_id: string
          nombre_fondo: string
          gestor_activos: string
          ticker_isin: string
          url_fuente: string
          fecha_scrapeo: string
          ods_encontrados: string[]
          keywords_encontradas: string[]
          puntuacion_impacto: string
          evidencia_texto: string
          es_elegible?: string | null
          resumen_requisitos?: string[] | null
          pasos_aplicacion?: string[] | null
          fechas_clave?: string | null
          link_directo_aplicacion?: string | null
          contact_emails?: string[] | null
          application_status?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          nombre_fondo?: string
          gestor_activos?: string
          ticker_isin?: string
          url_fuente?: string
          fecha_scrapeo?: string
          ods_encontrados?: string[]
          keywords_encontradas?: string[]
          puntuacion_impacto?: string
          evidencia_texto?: string
          es_elegible?: string | null
          resumen_requisitos?: string[] | null
          pasos_aplicacion?: string[] | null
          fechas_clave?: string | null
          link_directo_aplicacion?: string | null
          contact_emails?: string[] | null
          application_status?: string | null
          created_at?: string
          updated_at?: string
        }
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
  }
}
