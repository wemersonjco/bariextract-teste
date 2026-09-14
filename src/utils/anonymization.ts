// Geração de códigos anonimizados para pacientes (ex: PAC-7F3K9).
//
// O código é aleatório e não guarda nenhuma relação com o nome, o número do
// prontuário ou a ordem de cadastro do paciente. O nome real correspondente
// a cada código só existe na tabela "patient_identities" do Supabase (o
// "gabarito"), que não é legível pelo app — só por quem acessa o banco
// diretamente (Table Editor / SQL Editor).
//
// O alfabeto exclui caracteres que se confundem visualmente (0/O, 1/I) para
// facilitar a conferência manual do código.
const ANON_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ANON_CODE_LENGTH = 5;
const ANON_PREFIX = 'PAC-';

export const gerarCodigoAnonimizado = (): string => {
  let sufixo = '';
  for (let i = 0; i < ANON_CODE_LENGTH; i++) {
    sufixo += ANON_CHARSET[Math.floor(Math.random() * ANON_CHARSET.length)];
  }
  return `${ANON_PREFIX}${sufixo}`;
};

/**
 * Gera N códigos anonimizados, garantindo que não haja repetição dentro do
 * próprio lote (colisão com códigos já existentes no banco é praticamente
 * impossível — 32^5 combinações — mas o UNIQUE da coluna cobre esse caso).
 */
export const gerarCodigosAnonimizados = (quantidade: number): string[] => {
  const codigos = new Set<string>();
  while (codigos.size < quantidade) {
    codigos.add(gerarCodigoAnonimizado());
  }
  return Array.from(codigos);
};
