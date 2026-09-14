-- =====================================================
-- BARIEXTRACT LOCAL — Criação da tabela de pacientes
-- Execute este script inteiro no SQL Editor do seu NOVO projeto Supabase
-- (o de dados separados do sistema principal)
--
-- Diferenças em relação aos scripts originais do projeto:
-- 1) NÃO cria a tabela "exames_laboratoriais" — a feature de
--    "Extração Complementar (Laboratoriais)" foi removida desta cópia local.
-- 2) Corrige a política de RLS: o script original comparava
--    auth.uid() com o id do próprio paciente, o que bloqueava
--    inserts/updates na prática. Como este é um app de uso
--    interno (login único, não multi-tenant por paciente), a
--    política abaixo libera CRUD completo para qualquer usuário
--    autenticado.
-- 3) Já nasce com o esquema de anonimização: em vez de "nome", os
--    pacientes têm "codigo_anonimizado" (ex: PAC-7F3K9). O nome real e o
--    número do prontuário ficam isolados na tabela "patient_identities"
--    (o gabarito), que o app só consegue gravar — nunca ler de volta.
--    ATENÇÃO: se você já rodou uma versão anterior deste script (com as
--    colunas "nome" e/ou "prontuario"), NÃO rode este arquivo de novo —
--    rode em vez disso, em ordem, "supabase_migration_anonimizacao.sql"
--    e depois "supabase_migration_prontuario.sql", que migram o que já
--    existe.
-- =====================================================

CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Identificação (nome real e prontuário NÃO ficam aqui — veja patient_identities)
  num TEXT,
  codigo_anonimizado TEXT UNIQUE NOT NULL,
  sexo TEXT,
  idade_primeira_consulta TEXT,
  municipio TEXT,
  estado_civil TEXT,
  num_filhos TEXT,
  ocupacao TEXT,
  escolaridade TEXT,
  cuidador_pos_op TEXT,

  -- Datas importantes
  data_primeira_consulta TEXT,
  data_emissao_aih TEXT,
  tempo_protocolo TEXT,
  data_cirurgia TEXT,
  idade_na_cirurgia TEXT,

  -- Dados cirúrgicos
  tipo_cirurgia TEXT,
  peso_inicial TEXT,
  peso_ultimo_pre_op TEXT,
  variacao_peso_pre_op TEXT,
  altura TEXT,
  imc_inicial TEXT,
  imc_ultimo_pre_op TEXT,
  expectativa_peso TEXT,
  perda_esperada TEXT,

  -- Hábitos
  tabagismo TEXT,
  etilismo TEXT,
  atividade_fisica_pre TEXT,
  comer_emocional TEXT,
  autoavaliacao_psicologica TEXT,
  obesidade_desde TEXT,
  tentativas_emagrecimento TEXT,
  cirurgias_previas TEXT,

  -- Comorbidades
  has TEXT,
  dm2 TEXT,
  dislipidemia TEXT,
  esteatose_hepatica TEXT,
  colelitiase_pre TEXT,
  asma TEXT,
  outras_comorbidades TEXT,
  medicacoes_em_uso TEXT,

  -- EDA e USG pré-operatórios
  h_pylori_resultado TEXT,
  h_pylori_situacao TEXT,
  eda_resultado TEXT,
  fez_colonoscopia TEXT,
  resultado_colonoscopia TEXT,
  outras_alteracoes_gi TEXT,
  usg_abdome TEXT,
  espirometria_resultado TEXT,
  rx_torax TEXT,
  eco_fe TEXT,
  eco_psap TEXT,
  eco_outras_alteracoes TEXT,
  risco_pulmonar TEXT,
  risco_cv TEXT,
  clexane_dose TEXT,

  -- Exames laboratoriais "gerais" (fazem parte do prontuário completo,
  -- não têm relação com a feature de laboratoriais removida)
  hba1c TEXT,
  glicemia_jejum TEXT,
  tsh TEXT,
  t4_livre TEXT,
  b12 TEXT,
  vitamina_d TEXT,
  colesterol_total TEXT,
  hdl TEXT,
  ldl TEXT,
  triglicerideos TEXT,
  tgo TEXT,
  tgp TEXT,

  -- Dados pós-operatórios
  peso_po_9dias TEXT,
  peso_po_40dias TEXT,
  peso_po_4_5meses TEXT,
  peso_po_5meses TEXT,
  peso_po_7meses TEXT,
  peso_po_11meses TEXT,
  peso_1ano_po TEXT,
  perda_absoluta_1ano TEXT,
  percent_excesso_peso_perdido TEXT,
  atividade_fisica_1ano_po TEXT,
  excesso_pele TEXT,
  complicacoes_po TEXT,
  adesao_suplementacao TEXT,
  alta_cb TEXT,
  observacoes_clinicas TEXT,
  ultimo_imc TEXT,

  -- EDA e USG pós-operatórios
  eda_pos_data TEXT,
  eda_pos_urease TEXT,
  eda_pos_hpylori TEXT,
  eda_pos_achados TEXT,
  usg_pos_data TEXT,
  usg_pos_vesicula TEXT,
  usg_pos_observacoes TEXT,

  last_edited_at TIMESTAMPTZ
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_patients_codigo_anonimizado ON patients(codigo_anonimizado);
CREATE INDEX IF NOT EXISTS idx_patients_data_cirurgia ON patients(data_cirurgia);
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients(created_at);

-- Row Level Security
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage patients" ON patients;
CREATE POLICY "Authenticated users can manage patients" ON patients
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Trigger para manter updated_at em dia
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_patients_updated_at ON patients;
CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Gabarito de anonimização (nome real e prontuário <-> paciente)
-- =====================================================
CREATE TABLE IF NOT EXISTS patient_identities (
  patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
  nome_original TEXT NOT NULL,
  prontuario_original TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE patient_identities ENABLE ROW LEVEL SECURITY;

-- O app só consegue INSERIR (na extração) e EXCLUIR (ao remover um
-- paciente). Não existe política de SELECT nem de UPDATE de propósito —
-- ninguém usando o app, nem autenticado, consegue ler nome ou prontuário
-- de volta.
DROP POLICY IF EXISTS "App pode gravar identidade" ON patient_identities;
CREATE POLICY "App pode gravar identidade" ON patient_identities
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "App pode excluir identidade" ON patient_identities;
CREATE POLICY "App pode excluir identidade" ON patient_identities
  FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- Verificação final (deve mostrar as tabelas e 0 registros)
-- =====================================================
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('patients', 'patient_identities');

SELECT COUNT(*) AS total_pacientes FROM patients;
SELECT COUNT(*) AS total_identidades_no_gabarito FROM patient_identities;
