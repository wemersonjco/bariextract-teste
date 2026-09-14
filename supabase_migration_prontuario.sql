-- =====================================================
-- BARIEXTRACT LOCAL — Anonimização também do prontuário
-- Execute no SQL Editor do seu projeto Supabase LOCAL,
-- depois de já ter rodado o supabase_migration_anonimizacao.sql
-- =====================================================
--
-- O que este script faz:
--
-- 1) Adiciona a coluna prontuario_original em "patient_identities" — o
--    número do prontuário passa a fazer parte do gabarito, exatamente como
--    o nome: o app consegue GRAVAR ali, mas nunca LER de volta (não existe
--    política de SELECT nem de UPDATE nessa tabela).
--
-- 2) Se você já tiver pacientes de teste cadastrados com "prontuario"
--    preenchido na tabela patients, este script migra automaticamente esse
--    valor para o gabarito antes de remover a coluna. Se a tabela já
--    estiver vazia (ou você preferir simplificar apagando os pacientes de
--    teste primeiro no Table Editor), este passo não faz nada.
--
-- 3) Remove a coluna "prontuario" de "patients" — a partir de agora, o
--    número do prontuário nunca mais fica em uma tabela que o app consegue
--    ler. Nem o app, nem quem estiver logado, consegue mais ver o
--    prontuário de um paciente por nenhum lugar do sistema — só quem
--    acessa o Supabase diretamente (Table Editor / SQL Editor).
--
-- =====================================================

-- 1) Nova coluna no gabarito
ALTER TABLE patient_identities ADD COLUMN IF NOT EXISTS prontuario_original TEXT;

-- 2) Migrar prontuários de pacientes de teste que já existam
DO $$
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patients' AND column_name = 'prontuario'
  ) THEN
    FOR r IN SELECT id, prontuario FROM patients WHERE prontuario IS NOT NULL AND prontuario <> '' LOOP
      -- Se já existe uma linha no gabarito para este paciente (do passo do
      -- nome), só atualiza o prontuario_original nela. Senão, cria a linha
      -- já com o prontuário (sem nome, pois nesse caso ele não foi migrado).
      UPDATE patient_identities
      SET prontuario_original = r.prontuario
      WHERE patient_id = r.id;

      IF NOT FOUND THEN
        INSERT INTO patient_identities (patient_id, nome_original, prontuario_original)
        VALUES (r.id, '(não informado)', r.prontuario)
        ON CONFLICT (patient_id) DO UPDATE SET prontuario_original = EXCLUDED.prontuario_original;
      END IF;
    END LOOP;
  END IF;
END $$;

-- 3) Remove a coluna e o índice de patients — o prontuário real não fica
-- mais em nenhuma tabela legível pelo app.
DROP INDEX IF EXISTS idx_patients_prontuario;
ALTER TABLE patients DROP COLUMN IF EXISTS prontuario;

-- =====================================================
-- Verificação final
-- =====================================================

-- Confere que "prontuario" não existe mais em patients
SELECT column_name FROM information_schema.columns
WHERE table_name = 'patients' ORDER BY ordinal_position;

SELECT COUNT(*) AS total_pacientes FROM patients;
SELECT COUNT(*) AS total_identidades_no_gabarito FROM patient_identities;

-- Para descobrir o nome E o prontuário reais de um paciente a partir do
-- código anonimizado, rode esta consulta (só funciona aqui no SQL Editor,
-- com acesso direto ao banco):
--
-- SELECT p.codigo_anonimizado, i.nome_original, i.prontuario_original
-- FROM patients p
-- JOIN patient_identities i ON i.patient_id = p.id
-- WHERE p.codigo_anonimizado = 'PAC-XXXXX';
