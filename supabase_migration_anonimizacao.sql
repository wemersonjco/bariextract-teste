-- =====================================================
-- BARIEXTRACT LOCAL — Anonimização de pacientes (gabarito)
-- Execute no SQL Editor do seu projeto Supabase LOCAL,
-- depois de já ter rodado o supabase_setup_local.sql
-- =====================================================
--
-- O que este script faz:
--
-- 1) Adiciona a coluna codigo_anonimizado em "patients" (ex: PAC-7F3K9) —
--    é esse código que passa a identificar o paciente em todo o app e no
--    Excel exportado.
--
-- 2) Cria a tabela "patient_identities" (o gabarito): guarda o nome real
--    de cada paciente, ligado só pelo patient_id.
--
-- 3) Se você já tiver pacientes de teste cadastrados com "nome" na tabela
--    patients, este script migra automaticamente esses nomes para o
--    gabarito (gerando um código para cada um) antes de remover a coluna.
--    Se a tabela já estiver vazia, este passo simplesmente não faz nada.
--
-- 4) Configura a segurança (RLS) do gabarito: o app consegue GRAVAR o nome
--    ali na hora da extração (INSERT) e apagar (DELETE, para acompanhar a
--    exclusão de um paciente), mas NÃO existe nenhuma política de SELECT
--    ou UPDATE — ou seja, nem o próprio app, usando a chave anon/usuário
--    logado, consegue ler os nomes de volta. Só quem entra direto no
--    Supabase (Table Editor / SQL Editor, fora do app) consegue ver.
--
-- =====================================================

-- 1) Nova coluna do código anonimizado
ALTER TABLE patients ADD COLUMN IF NOT EXISTS codigo_anonimizado TEXT;

-- 2) Tabela do gabarito (nome real <-> paciente)
CREATE TABLE IF NOT EXISTS patient_identities (
  patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
  nome_original TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) Migrar pacientes de teste que já tenham "nome" preenchido
DO $$
DECLARE
  r RECORD;
  novo_codigo TEXT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  tentativas INT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patients' AND column_name = 'nome'
  ) THEN
    FOR r IN SELECT id, nome FROM patients WHERE nome IS NOT NULL AND nome <> '' LOOP
      tentativas := 0;
      LOOP
        novo_codigo := 'PAC-' || (
          SELECT string_agg(substr(chars, (floor(random() * length(chars)) + 1)::int, 1), '')
          FROM generate_series(1, 5)
        );
        BEGIN
          UPDATE patients SET codigo_anonimizado = novo_codigo WHERE id = r.id;
          EXIT;
        EXCEPTION WHEN unique_violation THEN
          tentativas := tentativas + 1;
          IF tentativas > 10 THEN
            RAISE EXCEPTION 'Não foi possível gerar código único para paciente %', r.id;
          END IF;
        END;
      END LOOP;

      INSERT INTO patient_identities (patient_id, nome_original)
      VALUES (r.id, r.nome)
      ON CONFLICT (patient_id) DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- 4) Gera código para qualquer paciente que ainda esteja sem (caso raro)
UPDATE patients
SET codigo_anonimizado = 'PAC-' || upper(substr(md5(random()::text || id::text), 1, 5))
WHERE codigo_anonimizado IS NULL;

-- 5) Torna o código obrigatório e único
ALTER TABLE patients ALTER COLUMN codigo_anonimizado SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patients_codigo_anonimizado_key'
  ) THEN
    ALTER TABLE patients ADD CONSTRAINT patients_codigo_anonimizado_key UNIQUE (codigo_anonimizado);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_patients_codigo_anonimizado ON patients(codigo_anonimizado);

-- 6) Remove a coluna "nome" — o nome real só existe em patient_identities daqui pra frente
ALTER TABLE patients DROP COLUMN IF EXISTS nome;

-- 7) Segurança do gabarito
ALTER TABLE patient_identities ENABLE ROW LEVEL SECURITY;

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

-- Propositalmente NÃO existe política de SELECT nem de UPDATE nesta tabela.

-- =====================================================
-- Verificação final
-- =====================================================

-- Confere que "nome" não existe mais em patients e "codigo_anonimizado" existe
SELECT column_name FROM information_schema.columns
WHERE table_name = 'patients' ORDER BY ordinal_position;

SELECT COUNT(*) AS total_pacientes FROM patients;
SELECT COUNT(*) AS total_identidades_no_gabarito FROM patient_identities;

-- Para descobrir o nome real de um paciente a partir do código anonimizado,
-- rode esta consulta (só funciona aqui no SQL Editor, com acesso direto ao banco):
--
-- SELECT p.codigo_anonimizado, i.nome_original
-- FROM patients p
-- JOIN patient_identities i ON i.patient_id = p.id
-- WHERE p.codigo_anonimizado = 'PAC-XXXXX';
