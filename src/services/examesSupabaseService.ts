import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    storage: localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey);
};

// Função para converter data DD/MM/YYYY para YYYY-MM-DD (formato do Supabase)
export const converterDataParaSupabase = (data: string | undefined | null): string | null => {
  if (!data || data.trim() === '') return null;
  
  // Remove espaços e verifica se está no formato DD/MM/YYYY
  let dataLimpa = data.trim();
  
  // Se for um intervalo de datas, pega apenas a primeira data
  if (dataLimpa.includes(' a ') || dataLimpa.includes(' até ') || dataLimpa.includes(' - ')) {
    const separadores = [' a ', ' até ', ' - ', ' ao '];
    for (const sep of separadores) {
      if (dataLimpa.includes(sep)) {
        dataLimpa = dataLimpa.split(sep)[0].trim();
        break;
      }
    }
    console.log('Intervalo de datas detectado, usando primeira data:', data, '→', dataLimpa);
  }
  
  const regexData = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  
  if (!regexData.test(dataLimpa)) {
    console.warn('Data inválida, mantendo original:', data);
    return dataLimpa; // Retorna original se não for DD/MM/YYYY
  }
  
  const [, dia, mes, ano] = dataLimpa.match(regexData) || [];
  return `${ano}-${mes}-${dia}`;
};

/**
 * Grava o nome real e o número do prontuário do paciente no gabarito
 * (tabela "patient_identities").
 *
 * Importante: essa tabela tem uma política de segurança (RLS) que permite ao
 * app APENAS inserir e excluir registros — nunca ler. Ou seja, mesmo esta
 * função nunca conseguiria "ler de volta" um nome ou prontuário; ela só
 * grava. Depois de gravados, só são visíveis para quem acessa o Supabase
 * diretamente (Table Editor / SQL Editor), nunca pelo app.
 */
export const salvarIdentidadePaciente = async (
  patientId: string,
  nomeOriginal: string,
  prontuarioOriginal?: string
): Promise<{ error: any }> => {
  if (!isSupabaseConfigured()) return { error: new Error('Supabase não configurado') };

  const nome = nomeOriginal?.trim() || '';
  const prontuario = prontuarioOriginal?.trim() || '';
  if (!nome && !prontuario) return { error: null };

  try {
    const { error } = await supabase
      .from('patient_identities')
      .insert([{
        patient_id: patientId,
        nome_original: nome || '(não informado)',
        prontuario_original: prontuario || null
      }]);

    return { error };
  } catch (error) {
    console.error('Erro ao gravar identidade do paciente no gabarito:', error);
    return { error };
  }
};

