-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_name TEXT,
  address TEXT,
  company_type TEXT,
  status TEXT,
  financing_type TEXT[],
  incorporation_date TEXT,
  amount_required TEXT,
  has_brief BOOLEAN DEFAULT false,
  has_financials BOOLEAN DEFAULT false,
  selected_ods TEXT[],
  brief_file_name TEXT,
  financials_file_name TEXT,
  brief_file_base64 TEXT,
  brief_mime_type TEXT,
  financials_file_base64 TEXT,
  financials_mime_type TEXT,
  financial_metrics JSONB,
  ai_generated_summary TEXT,
  user_type TEXT DEFAULT 'demo' CHECK (user_type IN ('demo', 'basic', 'premium')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create funds table
CREATE TABLE IF NOT EXISTS funds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nombre_fondo TEXT NOT NULL,
  gestor_activos TEXT NOT NULL,
  ticker_isin TEXT NOT NULL,
  url_fuente TEXT NOT NULL,
  fecha_scrapeo TEXT NOT NULL,
  ods_encontrados TEXT[] NOT NULL,
  keywords_encontradas TEXT[] NOT NULL,
  puntuacion_impacto TEXT NOT NULL,
  evidencia_texto TEXT NOT NULL,
  es_elegible TEXT,
  resumen_requisitos TEXT[],
  pasos_aplicacion TEXT[],
  fechas_clave TEXT,
  link_directo_aplicacion TEXT,
  contact_emails TEXT[],
  application_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_funds_user_id ON funds(user_id);
CREATE INDEX IF NOT EXISTS idx_funds_created_at ON funds(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE funds ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = user_id);

-- Create policies for funds
CREATE POLICY "Users can view their own funds"
  ON funds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own funds"
  ON funds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own funds"
  ON funds FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own funds"
  ON funds FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_funds_updated_at BEFORE UPDATE ON funds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
