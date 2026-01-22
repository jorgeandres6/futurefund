
declare global {
  interface Window {
    XLSX: any;
  }
}

export interface ApplicationAnalysis {
  es_elegible: string;
  resumen_requisitos: string[];
  pasos_aplicacion: string[];
  fechas_clave: string;
  link_directo_aplicacion: string;
  contact_emails: string[];
}

export interface Fund {
  nombre_fondo: string;
  gestor_activos: string;
  ticker_isin: string;
  url_fuente: string;
  fecha_scrapeo: string;
  alineacion_detectada: {
    ods_encontrados: string[];
    keywords_encontradas: string[];
    puntuacion_impacto: string;
  };
  evidencia_texto: string;
  analisis_aplicacion?: ApplicationAnalysis; // Optional field to store analysis
  applicationStatus?: string; // Status of the application (PENDIENTE, CONTACTED, etc.)
}

export interface FinancialMetrics {
  van: string;
  tir: string;
  ebitda: string;
}

export interface CompanyProfile {
  companyName: string;
  address: string;
  companyType: string; // S.A., Cia. Ltda., Org. S.A.S
  status: string;
  financingType: string[]; // Changed from string to string[] for multiple selection
  incorporationDate: string;
  amountRequired: string;
  hasBrief: boolean;
  hasFinancials: boolean;
  
  // New field for selected ODS instead of file
  selectedOds: string[];

  // New fields for file attachments
  briefFileName?: string;
  financialsFileName?: string;
  
  // Fields for actual file content processing
  briefFileBase64?: string;
  briefMimeType?: string;
  
  financialsFileBase64?: string;
  financialsMimeType?: string;
  
  financialMetrics?: FinancialMetrics;

  // New field for AI generated content
  aiGeneratedSummary?: string;
  
  // User type for feature access control
  userType?: 'demo' | 'basic' | 'premium';
}

export interface User {
  name: string;
  email: string;
  password?: string; // Added for local DB persistence
  profile?: CompanyProfile;
}
