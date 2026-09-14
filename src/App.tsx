/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Download, 
  Trash2, 
  Plus, 
  Search, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Database,
  ClipboardList,
  Share2,
  ExternalLink,
  LayoutDashboard,
  Users,
  Edit3,
  Save,
  X,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  Activity,
  History,
  Calendar,
  BarChart3,
  TrendingUp,
  LogOut,
  ShieldCheck,
  Sparkles,
  Check,
  Info,
  FileDown,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { useDropzone } from 'react-dropzone';
import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title,
  PointElement,
  LineElement
} from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';
import { format, differenceInMonths, differenceInYears, parse } from 'date-fns';
import { PatientData, CSV_HEADERS } from './types';
import { extractPatientData } from './services/geminiService';
import { normalizarDatasPaciente } from './utils/dataUtils';
import { gerarCodigosAnonimizados } from './utils/anonymization';
import {
  converterDataParaSupabase,
  isSupabaseConfigured,
  salvarIdentidadePaciente,
  supabase
} from './services/examesSupabaseService';
import Login from './components/Login';
import Loading from './components/Loading';
import Sobre from './components/Sobre';
import Tour from './components/Tour';

const TOUR_SEEN_KEY = 'bariextract_tour_seen';

ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title,
  PointElement,
  LineElement
);

type Tab = 'dashboard' | 'patients' | 'sobre';

export default function App() {
  // Estados de autenticação
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTour, setShowTour] = useState(false);

  // Estados existentes
  const [activeTab, setActiveTab] = useState<Tab>('patients');
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<PatientData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentRecord, setCurrentRecord] = useState('');
  const [currentFiles, setCurrentFiles] = useState<{ data: string, mimeType: string, name: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<'anonimizando' | 'extraindo' | 'revisando' | 'finalizando' | 'completo' | null>(null);
  const [reviewQueue, setReviewQueue] = useState<{ patient: PatientData; nomeExtraido: string; prontuarioExtraido: string }[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [retryStatus, setRetryStatus] = useState<string>('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Verificar sessão ao carregar o app
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Erro ao verificar sessão:', error);
          setUser(null);
        } else {
          setUser(session?.user || null);
        }
      } catch (err) {
        console.error('Erro inesperado ao verificar sessão:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Mostrar o tour de boas-vindas na primeira vez que o usuário loga neste
  // navegador (guardado em localStorage). Pode ser revisto a qualquer momento
  // pelo botão de ajuda no cabeçalho.
  useEffect(() => {
    if (!user) return;
    try {
      const seen = window.localStorage.getItem(TOUR_SEEN_KEY);
      if (!seen) setShowTour(true);
    } catch {
      // localStorage indisponível (ex: modo privado) - segue sem o tour
    }
  }, [user]);

  const handleFinishTour = () => {
    setShowTour(false);
    try {
      window.localStorage.setItem(TOUR_SEEN_KEY, '1');
    } catch {
      // localStorage indisponível - sem problema, o tour só não será lembrado
    }
  };

  // Load patients from Supabase
  useEffect(() => {
    const loadPatients = async () => {
      console.log('Iniciando loadPatients...');
      console.log('isSupabaseConfigured:', isSupabaseConfigured());
      
      if (!isSupabaseConfigured()) {
        console.log('Supabase não configurado, setando isLoading false');
        setIsLoading(false);
        return;
      }
      try {
        console.log('Buscando pacientes do Supabase...');
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .order('created_at', { ascending: false });
        
        console.log('Resultado Supabase:', { data: data?.length || 0, error });
        
        if (error) throw error;
        
        // Map snake_case to camelCase
        const mappedData = (data || []).map((p: any) => ({
          id: p.id,
          num: p.num,
          codigoAnonimizado: p.codigo_anonimizado,
          sexo: p.sexo,
          idadePrimeiraConsulta: p.idade_primeira_consulta,
          municipio: p.municipio,
          estadoCivil: p.estado_civil,
          numFilhos: p.num_filhos,
          ocupacao: p.ocupacao,
          escolaridade: p.escolaridade,
          cuidadorPosOp: p.cuidador_pos_op,
          dataPrimeiraConsulta: p.data_primeira_consulta,
          dataEmissaoAIH: p.data_emissao_aih,
          tempoProtocolo: p.tempo_protocolo,
          dataCirurgia: p.data_cirurgia,
          idadeNaCirurgia: p.idade_na_cirurgia,
          tipoCirurgia: p.tipo_cirurgia,
          pesoInicial: p.peso_inicial,
          pesoUltimoPreOp: p.peso_ultimo_pre_op,
          variacaoPesoPreOp: p.variacao_peso_pre_op,
          altura: p.altura,
          imcInicial: p.imc_inicial,
          imcUltimoPreOp: p.imc_ultimo_pre_op,
          expectativaPeso: p.expectativa_peso,
          perdaEsperada: p.perda_esperada,
          tabagismo: p.tabagismo,
          etilismo: p.etilismo,
          atividadeFisicaPre: p.atividade_fisica_pre,
          comerEmocional: p.comer_emocional,
          autoavaliacaoPsicologica: p.autoavaliacao_psicologica,
          obesidadeDesde: p.obesidade_desde,
          tentativasEmagrecimento: p.tentativas_emagrecimento,
          cirurgiasPrevias: p.cirurgias_previas,
          has: p.has,
          dm2: p.dm2,
          dislipidemia: p.dislipidemia,
          esteatoseHepatica: p.esteatose_hepatica,
          colelitiasePre: p.colelitiase_pre,
          asma: p.asma,
          outrasComorbidades: p.outras_comorbidades,
          medicacoesEmUso: p.medicacoes_em_uso,
          hPyloriResultado: p.h_pylori_resultado,
          hPyloriSituacao: p.h_pylori_situacao,
          edaResultado: p.eda_resultado,
          fezColonoscopia: p.fez_colonoscopia,
          resultadoColonoscopia: p.resultado_colonoscopia,
          usgAbdome: p.usg_abdome,
          pesoPO9dias: p.peso_po_9dias,
          pesoPO40dias: p.peso_po_40dias,
          pesoPO4_5meses: p.peso_po_4_5meses,
          pesoPO5meses: p.peso_po_5meses,
          pesoPO7meses: p.peso_po_7meses,
          pesoPO11meses: p.peso_po_11meses,
          peso1AnoPO: p.peso_1ano_po,
          perdaAbsoluta1Ano: p.perda_absoluta_1ano,
          percentExcessoPesoPerdido: p.percent_excesso_peso_perdido,
          atividadeFisica1AnoPO: p.atividade_fisica_1ano_po,
          excessoPele: p.excesso_pele,
          complicacoesPO: p.complicacoes_po,
          adesaoSuplementacao: p.adesao_suplementacao,
          altaCB: p.alta_cb,
          observacoesClinicas: p.observacoes_clinicas,
          ultimoIMC: p.ultimo_imc,
          edaPosData: p.eda_pos_data || '',
          edaPosUrease: p.eda_pos_urease || '',
          edaPosHPylori: p.eda_pos_hpylori || '',
          edaPosAchados: p.eda_pos_achados || '',
          usgPosData: p.usg_pos_data || '',
          usgPosVesicula: p.usg_pos_vesicula || '',
          usgPosObservacoes: p.usg_pos_observacoes || '',
          lastEditedAt: p.last_edited_at || ''
        }));
        
        console.log('Pacientes mapeados:', mappedData.length);
        setPatients(mappedData);
      } catch (e) {
        console.error('Erro ao carregar pacientes:', e);
      } finally {
        console.log('loadPatients finalizado, setando isLoading false');
        setIsLoading(false);
      }
    };
    loadPatients();
  }, []);

  // Função de logout
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: { data: string, mimeType: string, name: string }[] = [];
    let filesProcessed = 0;

    acceptedFiles.forEach(file => {
      const reader = new FileReader();
      if (file.type === 'application/pdf') {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          newFiles.push({ data: base64, mimeType: file.type, name: file.name });
          filesProcessed++;
          if (filesProcessed === acceptedFiles.length) {
            setCurrentFiles(prev => [...prev, ...newFiles]);
            setCurrentRecord('');
          }
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = () => {
          // For text files, we treat them as individual records or add to the list
          // To keep it simple, we'll convert text files to a "file" object too for batch consistency
          const base64 = btoa(unescape(encodeURIComponent(reader.result as string)));
          newFiles.push({ data: base64, mimeType: 'text/plain', name: file.name });
          filesProcessed++;
          if (filesProcessed === acceptedFiles.length) {
            setCurrentFiles(prev => [...prev, ...newFiles]);
            setCurrentRecord('');
          }
        };
        reader.readAsText(file);
      }
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'text/plain': ['.txt'], 'application/pdf': ['.pdf'] },
    multiple: true 
  });

  // Se estiver carregando, mostrar loading
  if (loading) {
    return <Loading />;
  }

  // Se não houver usuário logado, mostrar tela de login
  if (!user) {
    return <Login onLogin={setUser} />;
  }

  const handleProcess = async () => {
    console.log('=== handleProcess iniciado ===');
    console.log('currentRecord:', currentRecord.trim());
    console.log('currentFiles:', currentFiles.length);
    console.log('isProcessing:', isProcessing);

    const hasText = currentRecord.trim().length > 0;
    const hasFiles = currentFiles.length > 0;

    console.log('hasText:', hasText);
    console.log('hasFiles:', hasFiles);

    if (!hasText && !hasFiles) {
      console.log('Retornando early: não há texto nem arquivos');
      return;
    }

    console.log('Iniciando processamento de', hasFiles ? currentFiles.length : '1', 'item(s)');

    setIsProcessing(true);
    setProgress(0);
    setRetryStatus('');
    setProcessingStage('extraindo');

    // Interceptador de console logs para capturar status de retry
    const originalConsoleWarn = console.warn;
    console.warn = (...args) => {
      const message = args.join(' ');
      if (message.includes('Modelo Gemini indisponível') || message.includes('Retrying')) {
        setRetryStatus(message);
      }
      originalConsoleWarn(...args);
    };

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      const itemsToProcess: { text?: string, file?: { data: string, mimeType: string } }[] = [];

      if (hasText) {
        itemsToProcess.push({ text: currentRecord });
      }

      currentFiles.forEach(f => {
        itemsToProcess.push({ file: { data: f.data, mimeType: f.mimeType } });
      });

      const total = itemsToProcess.length;

      // Etapa 1: Extraindo dados — a IA lê cada prontuário e estrutura os
      // dados clínicos. Só depois de extraído é que existe algo para
      // anonimizar (não daria para gerar um código "para" um prontuário
      // que ainda nem foi lido).
      // Rascunho em memória: a extração só monta os dados aqui. Nada é
      // gravado no Supabase (nem o paciente, nem o gabarito) até o usuário
      // revisar e confirmar na etapa seguinte.
      const draftQueue: { patient: PatientData; nomeExtraido: string; prontuarioExtraido: string }[] = [];

      for (let i = 0; i < total; i++) {
        // Add a small delay between requests to avoid hitting rate limits
        if (i > 0) await sleep(1000);

        const extracted = await extractPatientData(itemsToProcess[i]);
        const nomeExtraido = extracted.nome?.trim() || `Paciente ${patients.length + draftQueue.length + 1}`;
        // O prontuário real nunca entra no objeto PatientData — vai direto
        // para o gabarito junto com o nome, exatamente pelo mesmo motivo.
        const prontuarioExtraido = extracted.prontuario?.trim() || '';
        const newPatient: PatientData = {
          id: crypto.randomUUID(),
          num: (patients.length + draftQueue.length + 1).toString(),
          // Preenchido na etapa seguinte (Anonimizando dados), depois que
          // todo o lote já foi extraído.
          codigoAnonimizado: '',
          sexo: extracted.sexo?.trim() || '',
          idadePrimeiraConsulta: extracted.idadePrimeiraConsulta?.trim() || '',
          municipio: extracted.municipio?.trim() || '',
          estadoCivil: extracted.estadoCivil?.trim() || '',
          numFilhos: extracted.numFilhos?.trim() || '',
          ocupacao: extracted.ocupacao?.trim() || '',
          escolaridade: extracted.escolaridade?.trim() || '',
          cuidadorPosOp: extracted.cuidadorPosOp?.trim() || '',
          dataPrimeiraConsulta: extracted.dataPrimeiraConsulta?.trim() || '',
          dataEmissaoAIH: extracted.dataEmissaoAIH?.trim() || '',
          tempoProtocolo: extracted.tempoProtocolo?.trim() || '',
          dataCirurgia: extracted.dataCirurgia?.trim() || '',
          idadeNaCirurgia: extracted.idadeNaCirurgia?.trim() || '',
          tipoCirurgia: extracted.tipoCirurgia?.trim() || '',
          pesoInicial: extracted.pesoInicial?.trim() || '',
          pesoUltimoPreOp: extracted.pesoUltimoPreOp?.trim() || '',
          variacaoPesoPreOp: extracted.variacaoPesoPreOp?.trim() || '',
          altura: extracted.altura?.trim() || '',
          imcInicial: extracted.imcInicial?.trim() || '',
          imcUltimoPreOp: extracted.imcUltimoPreOp?.trim() || '',
          expectativaPeso: extracted.expectativaPeso?.trim() || '',
          perdaEsperada: extracted.perdaEsperada?.trim() || '',
          tabagismo: extracted.tabagismo?.trim() || '',
          etilismo: extracted.etilismo?.trim() || '',
          atividadeFisicaPre: extracted.atividadeFisicaPre?.trim() || '',
          comerEmocional: extracted.comerEmocional?.trim() || '',
          autoavaliacaoPsicologica: extracted.autoavaliacaoPsicologica?.trim() || '',
          obesidadeDesde: extracted.obesidadeDesde?.trim() || '',
          tentativasEmagrecimento: extracted.tentativasEmagrecimento?.trim() || '',
          cirurgiasPrevias: extracted.cirurgiasPrevias?.trim() || '',
          has: extracted.has?.trim() || '',
          dm2: extracted.dm2?.trim() || '',
          dislipidemia: extracted.dislipidemia?.trim() || '',
          esteatoseHepatica: extracted.esteatoseHepatica?.trim() || '',
          colelitiasePre: extracted.colelitiasePre?.trim() || '',
          asma: extracted.asma?.trim() || '',
          outrasComorbidades: extracted.outrasComorbidades?.trim() || '',
          medicacoesEmUso: extracted.medicacoesEmUso?.trim() || '',
          hPyloriResultado: extracted.hPyloriResultado?.trim() || '',
          hPyloriSituacao: extracted.hPyloriSituacao?.trim() || '',
          edaResultado: extracted.edaResultado?.trim() || '',
          fezColonoscopia: extracted.fezColonoscopia?.trim() || '',
          resultadoColonoscopia: extracted.resultadoColonoscopia?.trim() || '',
          usgAbdome: extracted.usgAbdome?.trim() || '',
          pesoPO9dias: extracted.pesoPO9dias?.trim() || '',
          pesoPO40dias: extracted.pesoPO40dias?.trim() || '',
          pesoPO4_5meses: extracted.pesoPO4_5meses?.trim() || '',
          pesoPO5meses: extracted.pesoPO5meses?.trim() || '',
          pesoPO7meses: extracted.pesoPO7meses?.trim() || '',
          pesoPO11meses: extracted.pesoPO11meses?.trim() || '',
          peso1AnoPO: extracted.peso1AnoPO?.trim() || '',
          perdaAbsoluta1Ano: extracted.perdaAbsoluta1Ano?.trim() || '',
          percentExcessoPesoPerdido: extracted.percentExcessoPesoPerdido?.trim() || '',
          atividadeFisica1AnoPO: extracted.atividadeFisica1AnoPO?.trim() || '',
          excessoPele: extracted.excessoPele?.trim() || '',
          complicacoesPO: extracted.complicacoesPO?.trim() || '',
          adesaoSuplementacao: extracted.adesaoSuplementacao?.trim() || '',
          altaCB: extracted.altaCB?.trim() || '',
          observacoesClinicas: extracted.observacoesClinicas?.trim() || '',
          ultimoIMC: extracted.ultimoIMC?.trim() || '',
          edaPosData: extracted.edaPosData?.trim() || '',
          edaPosUrease: extracted.edaPosUrease?.trim() || '',
          edaPosHPylori: extracted.edaPosHPylori?.trim() || '',
          edaPosAchados: extracted.edaPosAchados?.trim() || '',
          usgPosData: extracted.usgPosData?.trim() || '',
          usgPosVesicula: extracted.usgPosVesicula?.trim() || '',
          usgPosObservacoes: extracted.usgPosObservacoes?.trim() || '',
          lastEditedAt: new Date().toISOString()
        };

        // Normalizar datas para formato DD/MM/YYYY antes de exibir/salvar
        const pacienteNormalizado = normalizarDatasPaciente(newPatient);
        draftQueue.push({ patient: pacienteNormalizado, nomeExtraido, prontuarioExtraido });

        setProgress(Math.round(((i + 1) / total) * 100));
      }

      // Etapa 2: Anonimizando dados — só agora, com o lote já extraído,
      // cada paciente recebe um código aleatório (ex: PAC-7F3K9), sem
      // nenhuma relação com o conteúdo do prontuário. O nome e o
      // prontuário reais (guardados à parte, em nomeExtraido/prontuarioExtraido)
      // nunca chegam a fazer parte do objeto do paciente.
      setProcessingStage('anonimizando');
      const codigosAnonimizados = gerarCodigosAnonimizados(draftQueue.length);
      draftQueue.forEach((item, idx) => {
        item.patient.codigoAnonimizado = codigosAnonimizados[idx];
      });
      await sleep(600);

      // Etapa 3: Revisão clínica — nada foi salvo ainda. O usuário confere
      // (e pode editar ou descartar) cada paciente antes de gravar de fato.
      setReviewQueue(draftQueue);
      setReviewIndex(0);
      setProcessingStage('revisando');
    } catch (error: any) {
      console.error('Erro no processamento:', error);
      setProcessingStage(null);
      setIsProcessing(false);
      setProgress(0);

      // Mensagens de erro específicas
      if (error.message?.includes("Chave da API Gemini não configurada")) {
        alert('Erro: Chave da API Gemini não configurada. Verifique o arquivo .env e adicione sua chave VITE_GEMINI_KEY.');
      } else if (error.message?.includes("Chave da API Gemini inválida")) {
        alert('Erro: Chave da API Gemini inválida ou expirada. Verifique sua chave e tente novamente.');
      } else if (error.message?.includes("Erro de conexão")) {
        alert('Erro: Falha na conexão com a API. Verifique sua conexão com a internet e tente novamente.');
      } else if (error.message?.includes("Nenhum modelo Gemini disponível") || error.message?.includes("is not found")) {
        alert('Erro: Nenhum modelo Gemini disponível foi encontrado. Isso pode ser um problema temporário da API. Tente novamente em alguns minutos.');
      } else if (error.message?.includes("modelo Gemini está temporariamente indisponível") || error.message?.includes("alta demanda")) {
        alert('O modelo Gemini está temporariamente indisponível devido à alta demanda. O sistema tentará novamente automaticamente. Por favor, aguarde alguns instantes.');
      } else if (error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED")) {
        alert('Limite de uso do Gemini atingido. Por favor, aguarde um momento e tente novamente com menos arquivos.');
      } else if (error.message?.includes("Erro ao processar prontuário")) {
        alert(`Erro ao processar prontuário: ${error.message}`);
      } else {
        alert('Erro ao processar prontuários. Verifique sua conexão ou chave de API.\n\nDetalhes: ' + (error.message || 'Erro desconhecido'));
      }
    } finally {
      // Restaurar console.warn original
      console.warn = originalConsoleWarn;
      setRetryStatus('');
    }
  };

  // Atualiza um campo do paciente que está sendo revisado (ainda em memória,
  // nada foi salvo no banco).
  const updateReviewField = (field: keyof PatientData, value: string) => {
    setReviewQueue(prev => prev.map((item, idx) =>
      idx === reviewIndex ? { ...item, patient: { ...item.patient, [field]: value } } : item
    ));
  };

  const goToReviewIndex = (idx: number) => {
    setReviewIndex(prev => {
      const clamped = Math.max(0, Math.min(idx, reviewQueue.length - 1));
      return clamped;
    });
  };

  // Reseta o estado de revisão sem salvar nada (uso interno, sem confirmação
  // — a confirmação já aconteceu em quem chamou).
  const resetReviewState = () => {
    setReviewQueue([]);
    setReviewIndex(0);
    setIsProcessing(false);
    setProgress(0);
    setProcessingStage(null);
  };

  // Remove um paciente da fila de revisão sem salvar nada dele. Se era o
  // último da fila, cancela a revisão inteira (não há mais nada a revisar).
  const discardReviewPatient = (index: number) => {
    if (!confirm('Descartar este paciente da revisão? Os dados extraídos dele serão perdidos e ele não será salvo.')) return;
    const next = reviewQueue.filter((_, idx) => idx !== index);
    if (next.length === 0) {
      resetReviewState();
      return;
    }
    setReviewQueue(next);
    setReviewIndex(prev => Math.min(prev, next.length - 1));
  };

  // Cancela a revisão inteira: nenhum paciente do lote é salvo.
  const cancelReview = () => {
    if (!confirm('Cancelar toda a revisão? Nenhum paciente deste lote será salvo.')) return;
    resetReviewState();
  };

  // Grava de fato no Supabase todos os pacientes que sobraram na fila de
  // revisão (os que o usuário não descartou) — paciente + o nome real no
  // gabarito. Só a partir daqui os dados deixam de existir só em memória.
  const finalizeReview = async () => {
    if (reviewQueue.length === 0) {
      resetReviewState();
      return;
    }

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    setProcessingStage('finalizando');

    try {
      const savedPatients: PatientData[] = [];

      for (const item of reviewQueue) {
        const pacienteNormalizado = item.patient;
        const nomeExtraido = item.nomeExtraido;
        const prontuarioExtraido = item.prontuarioExtraido;

        // Converter datas para formato do Supabase (YYYY-MM-DD) antes de salvar
        const pacienteParaBanco = {
          ...pacienteNormalizado,
          dataPrimeiraConsulta: converterDataParaSupabase(pacienteNormalizado.dataPrimeiraConsulta),
          dataEmissaoAIH: converterDataParaSupabase(pacienteNormalizado.dataEmissaoAIH),
          dataCirurgia: converterDataParaSupabase(pacienteNormalizado.dataCirurgia),
          edaPosData: converterDataParaSupabase(pacienteNormalizado.edaPosData),
          usgPosData: converterDataParaSupabase(pacienteNormalizado.usgPosData)
        };

        // Save to Supabase if configured
        let savedPatientId = pacienteNormalizado.id;

        if (isSupabaseConfigured()) {
          const { data, error } = await supabase
            .from('patients')
            .insert([{
              num: pacienteParaBanco.num,
              codigo_anonimizado: pacienteParaBanco.codigoAnonimizado,
              sexo: pacienteParaBanco.sexo,
              idade_primeira_consulta: pacienteParaBanco.idadePrimeiraConsulta,
              municipio: pacienteParaBanco.municipio,
              estado_civil: pacienteParaBanco.estadoCivil,
              num_filhos: pacienteParaBanco.numFilhos,
              ocupacao: pacienteParaBanco.ocupacao,
              escolaridade: pacienteParaBanco.escolaridade,
              cuidador_pos_op: pacienteParaBanco.cuidadorPosOp,
              data_primeira_consulta: pacienteParaBanco.dataPrimeiraConsulta,
              data_emissao_aih: pacienteParaBanco.dataEmissaoAIH,
              tempo_protocolo: pacienteParaBanco.tempoProtocolo,
              data_cirurgia: pacienteParaBanco.dataCirurgia,
              idade_na_cirurgia: pacienteParaBanco.idadeNaCirurgia,
              tipo_cirurgia: pacienteParaBanco.tipoCirurgia,
              peso_inicial: pacienteParaBanco.pesoInicial,
              peso_ultimo_pre_op: pacienteParaBanco.pesoUltimoPreOp,
              variacao_peso_pre_op: pacienteParaBanco.variacaoPesoPreOp,
              altura: pacienteParaBanco.altura,
              imc_inicial: pacienteParaBanco.imcInicial,
              imc_ultimo_pre_op: pacienteParaBanco.imcUltimoPreOp,
              expectativa_peso: pacienteParaBanco.expectativaPeso,
              perda_esperada: pacienteParaBanco.perdaEsperada,
              tabagismo: pacienteParaBanco.tabagismo,
              etilismo: pacienteParaBanco.etilismo,
              atividade_fisica_pre: pacienteParaBanco.atividadeFisicaPre,
              comer_emocional: pacienteParaBanco.comerEmocional,
              autoavaliacao_psicologica: pacienteParaBanco.autoavaliacaoPsicologica,
              obesidade_desde: pacienteParaBanco.obesidadeDesde,
              tentativas_emagrecimento: pacienteParaBanco.tentativasEmagrecimento,
              cirurgias_previas: pacienteParaBanco.cirurgiasPrevias,
              has: pacienteParaBanco.has,
              dm2: pacienteParaBanco.dm2,
              dislipidemia: pacienteParaBanco.dislipidemia,
              esteatose_hepatica: pacienteParaBanco.esteatoseHepatica,
              colelitiase_pre: pacienteParaBanco.colelitiasePre,
              asma: pacienteParaBanco.asma,
              outras_comorbidades: pacienteParaBanco.outrasComorbidades,
              medicacoes_em_uso: pacienteParaBanco.medicacoesEmUso,
              h_pylori_resultado: pacienteParaBanco.hPyloriResultado,
              h_pylori_situacao: pacienteParaBanco.hPyloriSituacao,
              eda_resultado: pacienteParaBanco.edaResultado,
              fez_colonoscopia: pacienteParaBanco.fezColonoscopia,
              resultado_colonoscopia: pacienteParaBanco.resultadoColonoscopia,
              usg_abdome: pacienteParaBanco.usgAbdome,
              peso_po_9dias: pacienteParaBanco.pesoPO9dias,
              peso_po_40dias: pacienteParaBanco.pesoPO40dias,
              peso_po_4_5meses: pacienteParaBanco.pesoPO4_5meses,
              peso_po_5meses: pacienteParaBanco.pesoPO5meses,
              peso_po_7meses: pacienteParaBanco.pesoPO7meses,
              peso_po_11meses: pacienteParaBanco.pesoPO11meses,
              peso_1ano_po: pacienteParaBanco.peso1AnoPO,
              perda_absoluta_1ano: pacienteParaBanco.perdaAbsoluta1Ano,
              percent_excesso_peso_perdido: pacienteParaBanco.percentExcessoPesoPerdido,
              atividade_fisica_1ano_po: pacienteParaBanco.atividadeFisica1AnoPO,
              excesso_pele: pacienteParaBanco.excessoPele,
              complicacoes_po: pacienteParaBanco.complicacoesPO,
              adesao_suplementacao: pacienteParaBanco.adesaoSuplementacao,
              alta_cb: pacienteParaBanco.altaCB,
              observacoes_clinicas: pacienteParaBanco.observacoesClinicas,
              ultimo_imc: pacienteParaBanco.ultimoIMC,
              eda_pos_data: pacienteParaBanco.edaPosData,
              eda_pos_urease: pacienteParaBanco.edaPosUrease,
              eda_pos_hpylori: pacienteParaBanco.edaPosHPylori,
              eda_pos_achados: pacienteParaBanco.edaPosAchados,
              usg_pos_data: pacienteParaBanco.usgPosData,
              usg_pos_vesicula: pacienteParaBanco.usgPosVesicula,
              usg_pos_observacoes: pacienteParaBanco.usgPosObservacoes,
              last_edited_at: pacienteParaBanco.lastEditedAt
            }])
            .select('id')
            .single();

          if (error) {
            console.error('Erro ao salvar no Supabase:', error);
          } else if (data) {
            savedPatientId = data.id; // Usar o ID retornado pelo banco
            console.log('Paciente salvo com ID:', savedPatientId);

            // Grava o nome real no gabarito (patient_identities). O app só
            // consegue INSERIR aqui — nunca ler de volta (veja RLS no SQL).
            const { error: identityError } = await salvarIdentidadePaciente(savedPatientId, nomeExtraido, prontuarioExtraido);
            if (identityError) {
              console.error('Erro ao gravar identidade no gabarito:', identityError);
            }
          }
        }

        savedPatients.push({ ...pacienteNormalizado, id: savedPatientId });
      }

      setPatients(prev => [...prev, ...savedPatients]);
      if (savedPatients.length > 0 && !isAnimating) {
        setSelectedPatientId(savedPatients[savedPatients.length - 1].id);
      }
      setCurrentRecord('');
      setCurrentFiles([]);
      setReviewQueue([]);
      setReviewIndex(0);

      await sleep(400);
      setProcessingStage('completo');
      await sleep(1300);
    } catch (error: any) {
      console.error('Erro ao salvar pacientes revisados:', error);
      alert('Erro ao salvar os pacientes revisados. Verifique sua conexão e tente novamente.\n\nDetalhes: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setProcessingStage(null);
    }
  };

  const downloadExcel = async () => {
    const wb = XLSX.utils.book_new();
    
    // Normalizar datas de todos os pacientes antes de exportar
    const pacientesNormalizados = patients.map(p => normalizarDatasPaciente(p));
    
    // Dados Gerais — sem nome nem número de prontuário: o paciente é
    // identificado só pelo código anonimizado, para manter o arquivo
    // exportado seguro para uso em pesquisa.
    const generalData = pacientesNormalizados.map(p => [
      p.num, p.codigoAnonimizado, p.sexo, p.idadePrimeiraConsulta, p.municipio, p.estadoCivil, p.numFilhos, p.ocupacao, p.escolaridade, p.cuidadorPosOp, p.dataPrimeiraConsulta, p.dataEmissaoAIH, p.tempoProtocolo, p.dataCirurgia, p.idadeNaCirurgia, p.tipoCirurgia, p.pesoInicial, p.pesoUltimoPreOp, p.variacaoPesoPreOp, p.altura, p.imcInicial, p.imcUltimoPreOp, p.expectativaPeso, p.perdaEsperada, p.tabagismo, p.etilismo, p.atividadeFisicaPre, p.comerEmocional, p.autoavaliacaoPsicologica, p.obesidadeDesde, p.tentativasEmagrecimento, p.cirurgiasPrevias, p.observacoesClinicas, p.ultimoIMC
    ]);
    const wsGeneral = XLSX.utils.aoa_to_sheet([
      ["Nº", "Código Anonimizado", "Sexo", "Idade 1ª Consulta", "Município", "Estado Civil", "Nº Filhos", "Ocupação", "Escolaridade", "Cuidador Pós-op", "Data 1ª Consulta", "Data Emissão AIH", "Tempo Protocolo", "Data Cirurgia", "Idade na Cirurgia", "Tipo Cirurgia", "Peso Inicial", "Peso Último Pré-op", "Variação Peso", "Altura", "IMC Inicial", "IMC Último Pré-op", "Expectativa Peso", "Perda Esperada", "Tabagismo", "Etilismo", "Atividade Física Pré", "Comer Emocional", "Autoavaliação Psicológica", "Obesidade Desde", "Tentativas Emagrecimento", "Cirurgias Prévias", "Observações", "Último IMC"],
      ...generalData
    ]);
    XLSX.utils.book_append_sheet(wb, wsGeneral, "Dados Gerais");

    // Comorbidades
    const comorbData = pacientesNormalizados.map(p => [
      p.codigoAnonimizado, p.has, p.dm2, p.dislipidemia, p.esteatoseHepatica, p.colelitiasePre, p.asma, p.outrasComorbidades, p.medicacoesEmUso
    ]);
    const wsComorb = XLSX.utils.aoa_to_sheet([
      ["Código Anonimizado", "HAS", "DM2", "Dislipidemia", "Esteatose", "Colelitíase Pré", "Asma", "Outras", "Medicações"],
      ...comorbData
    ]);
    XLSX.utils.book_append_sheet(wb, wsComorb, "Comorbidades");

    // EDA e USG
    const edaUsgData = pacientesNormalizados.map(p => [
      p.codigoAnonimizado, p.hPyloriResultado, p.hPyloriSituacao, p.edaResultado, p.fezColonoscopia, p.resultadoColonoscopia, p.usgAbdome, p.edaPosData, p.edaPosUrease, p.edaPosHPylori, p.edaPosAchados, p.usgPosData, p.usgPosVesicula, p.usgPosObservacoes
    ]);
    const wsEdaUsg = XLSX.utils.aoa_to_sheet([
      ["Código Anonimizado", "H. Pylori Pré", "Situação H. Pylori", "EDA Pré", "Colonoscopia", "Resultado Colono", "USG Pré", "EDA Pós Data", "EDA Pós Urease", "EDA Pós H. Pylori", "EDA Pós Achados", "USG Pós Data", "USG Pós Vesícula", "USG Pós Obs"],
      ...edaUsgData
    ]);
    XLSX.utils.book_append_sheet(wb, wsEdaUsg, "EDA e USG");

    // Pós-operatório
    const poData = pacientesNormalizados.map(p => [
      p.codigoAnonimizado, p.pesoPO9dias, p.pesoPO40dias, p.pesoPO4_5meses, p.pesoPO5meses, p.pesoPO7meses, p.pesoPO11meses, p.peso1AnoPO, p.perdaAbsoluta1Ano, p.percentExcessoPesoPerdido, p.atividadeFisica1AnoPO, p.excessoPele, p.complicacoesPO, p.adesaoSuplementacao, p.altaCB
    ]);
    const wsPO = XLSX.utils.aoa_to_sheet([
      ["Código Anonimizado", "9 dias", "40 dias", "4,5 meses", "5 meses", "7 meses", "11 meses", "1 ano", "Perda Absoluta", "% Excesso Perdido", "Atividade Física", "Excesso Pele", "Complicações", "Adesão Supl.", "Alta"],
      ...poData
    ]);
    XLSX.utils.book_append_sheet(wb, wsPO, "Pós-operatório");

    XLSX.writeFile(wb, "pesquisa_bariatrica_completa.xlsx");
  };

  const removePatient = async (id: string) => {
    if (confirm('Deseja realmente excluir este paciente?')) {
      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('patients')
          .delete()
          .eq('id', id);
        if (error) {
          alert('Erro ao excluir do banco de dados.');
          return;
        }
      }
      setPatients(prev => prev.filter(p => p.id !== id));
      if (selectedPatientId === id) setSelectedPatientId(null);
    }
  };

  const handlePatientSelect = (patientId: string) => {
    if (!isAnimating && !isProcessing) {
      setIsAnimating(true);
      setSelectedPatientId(patientId);
      setTimeout(() => setIsAnimating(false), 300);
    }
  };

  const handleEdit = (patient: PatientData) => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300); // Reset após animação
    setEditData({ ...patient });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editData) return;
    if (!confirm('Deseja salvar as alterações realizadas neste paciente?')) return;

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const updatedPatient = { ...editData, lastEditedAt: now };

      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('patients')
          .update({
            num: updatedPatient.num,
            codigo_anonimizado: updatedPatient.codigoAnonimizado,
            sexo: updatedPatient.sexo,
            idade_primeira_consulta: updatedPatient.idadePrimeiraConsulta,
            municipio: updatedPatient.municipio,
            estado_civil: updatedPatient.estadoCivil,
            num_filhos: updatedPatient.numFilhos,
            ocupacao: updatedPatient.ocupacao,
            escolaridade: updatedPatient.escolaridade,
            cuidador_pos_op: updatedPatient.cuidadorPosOp,
            data_primeira_consulta: updatedPatient.dataPrimeiraConsulta,
            data_emissao_aih: updatedPatient.dataEmissaoAIH,
            tempo_protocolo: updatedPatient.tempoProtocolo,
            data_cirurgia: updatedPatient.dataCirurgia,
            idade_na_cirurgia: updatedPatient.idadeNaCirurgia,
            tipo_cirurgia: updatedPatient.tipoCirurgia,
            peso_inicial: updatedPatient.pesoInicial,
            peso_ultimo_pre_op: updatedPatient.pesoUltimoPreOp,
            variacao_peso_pre_op: updatedPatient.variacaoPesoPreOp,
            altura: updatedPatient.altura,
            imc_inicial: updatedPatient.imcInicial,
            imc_ultimo_pre_op: updatedPatient.imcUltimoPreOp,
            expectativa_peso: updatedPatient.expectativaPeso,
            perda_esperada: updatedPatient.perdaEsperada,
            tabagismo: updatedPatient.tabagismo,
            etilismo: updatedPatient.etilismo,
            atividade_fisica_pre: updatedPatient.atividadeFisicaPre,
            comer_emocional: updatedPatient.comerEmocional,
            autoavaliacao_psicologica: updatedPatient.autoavaliacaoPsicologica,
            obesidade_desde: updatedPatient.obesidadeDesde,
            tentativas_emagrecimento: updatedPatient.tentativasEmagrecimento,
            cirurgias_previas: updatedPatient.cirurgiasPrevias,
            has: updatedPatient.has,
            dm2: updatedPatient.dm2,
            dislipidemia: updatedPatient.dislipidemia,
            esteatose_hepatica: updatedPatient.esteatoseHepatica,
            colelitiase_pre: updatedPatient.colelitiasePre,
            asma: updatedPatient.asma,
            outras_comorbidades: updatedPatient.outrasComorbidades,
            medicacoes_em_uso: updatedPatient.medicacoesEmUso,
            h_pylori_resultado: updatedPatient.hPyloriResultado,
            h_pylori_situacao: updatedPatient.hPyloriSituacao,
            eda_resultado: updatedPatient.edaResultado,
            fez_colonoscopia: updatedPatient.fezColonoscopia,
            resultado_colonoscopia: updatedPatient.resultadoColonoscopia,
            usg_abdome: updatedPatient.usgAbdome,
            peso_po_9dias: updatedPatient.pesoPO9dias,
            peso_po_40dias: updatedPatient.pesoPO40dias,
            peso_po_4_5meses: updatedPatient.pesoPO4_5meses,
            peso_po_5meses: updatedPatient.pesoPO5meses,
            peso_po_7meses: updatedPatient.pesoPO7meses,
            peso_po_11meses: updatedPatient.pesoPO11meses,
            peso_1ano_po: updatedPatient.peso1AnoPO,
            perda_absoluta_1ano: updatedPatient.perdaAbsoluta1Ano,
            percent_excesso_peso_perdido: updatedPatient.percentExcessoPesoPerdido,
            atividade_fisica_1ano_po: updatedPatient.atividadeFisica1AnoPO,
            excesso_pele: updatedPatient.excessoPele,
            complicacoes_po: updatedPatient.complicacoesPO,
            adesao_suplementacao: updatedPatient.adesaoSuplementacao,
            alta_cb: updatedPatient.altaCB,
            observacoes_clinicas: updatedPatient.observacoesClinicas,
            ultimo_imc: updatedPatient.ultimoIMC,
            eda_pos_data: updatedPatient.edaPosData,
            eda_pos_urease: updatedPatient.edaPosUrease,
            eda_pos_hpylori: updatedPatient.edaPosHPylori,
            eda_pos_achados: updatedPatient.edaPosAchados,
            usg_pos_data: updatedPatient.usgPosData,
            usg_pos_vesicula: updatedPatient.usgPosVesicula,
            usg_pos_observacoes: updatedPatient.usgPosObservacoes,
            last_edited_at: now
          })
          .eq('id', updatedPatient.id);
        
        if (error) throw error;
      }

      setPatients(prev => prev.map(p => p.id === updatedPatient.id ? updatedPatient : p));
      setIsEditing(false);
      setEditData(null);
    } catch (e) {
      console.error('Erro ao salvar edição:', e);
      alert('Erro ao salvar alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredPatients = patients.filter(p =>
    p.codigoAnonimizado.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedPatient = patients.find(p => p.id === selectedPatientId) || null;

  const calculatePostOpTime = (cirurgia: string | null | undefined, exame: string | null | undefined) => {
    if (!cirurgia?.trim() || !exame?.trim()) return 'N/A';
    try {
      const dateCirurgia = parse(cirurgia.trim(), 'dd/MM/yyyy', new Date());
      const dateExame = parse(exame.trim(), 'dd/MM/yyyy', new Date());
      const months = differenceInMonths(dateExame, dateCirurgia);
      if (months < 12) return `${months} meses`;
      const years = differenceInYears(dateExame, dateCirurgia);
      const remainingMonths = months % 12;
      return remainingMonths > 0 ? `${years} anos e ${remainingMonths} meses` : `${years} anos`;
    } catch (e) {
      return 'Erro no cálculo';
    }
  };

  const renderEditForm = () => {
    if (!editData) return null;

    const handleChange = (field: keyof PatientData, value: string) => {
      setEditData(prev => prev ? { ...prev, [field]: value } : null);
    };

    return (
      <motion.div 
        key={`edit-${editData?.id || 'new'}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      >
        <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent-500 rounded-lg text-white">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">Editar Paciente</h2>
                <p className="text-xs text-slate-500">Alterando dados de {editData.codigoAnonimizado}</p>
              </div>
            </div>
            <button
              onClick={() => setIsEditing(false)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {EDITABLE_FIELD_SECTIONS.map((section) => (
              <div key={section.title} className="space-y-3">
                <h3 className="text-xs font-bold text-brand-600 uppercase tracking-widest">{section.title}</h3>
                {section.fields.map((f) => (
                  <EditField
                    key={f.key}
                    label={f.label}
                    value={editData[f.key]}
                    onChange={(v) => handleChange(f.key, v)}
                  />
                ))}
              </div>
            ))}

            <div className="space-y-3 lg:col-span-3">
              <h3 className="text-xs font-bold text-brand-600 uppercase tracking-widest">Observações Gerais</h3>
              <textarea
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 min-h-[100px]"
                value={editData.observacoesClinicas}
                onChange={(e) => handleChange('observacoesClinicas', e.target.value)}
              />
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
            <button 
              onClick={() => setIsEditing(false)}
              className="px-6 py-2 text-slate-600 font-bold text-xs hover:bg-slate-100 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSaveEdit}
              disabled={isSaving}
              className="px-8 py-2 bg-brand-600 text-white font-bold text-xs rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-600/20 flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Salvar Alterações
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderDashboard = () => {
    const totalPatients = patients.length;
    const bypassCount = patients.filter(p => p.tipoCirurgia?.toLowerCase().includes('bypass')).length;
    const sleeveCount = patients.filter(p => p.tipoCirurgia?.toLowerCase().includes('sleeve')).length;
    const otherSurgCount = totalPatients - bypassCount - sleeveCount;

    const maleCount = patients.filter(p => p.sexo?.toLowerCase() === 'masculino').length;
    const femaleCount = patients.filter(p => p.sexo?.toLowerCase() === 'feminino').length;

    const hPyloriPreCount = patients.filter(p => p.hPyloriResultado?.toLowerCase().includes('pos')).length;
    const hPyloriPosCount = patients.filter(p => p.edaPosHPylori?.toLowerCase().includes('pos')).length;

    const colelitiasePosCount = patients.filter(p => p.usgPosVesicula?.toLowerCase().includes('coleli')).length;

    const surgeryTypeData = {
      labels: ['Bypass', 'Sleeve', 'Outros'],
      datasets: [{
        data: [bypassCount, sleeveCount, otherSurgCount],
        backgroundColor: ['#10B981', '#3B82F6', '#F59E0B'],
      }]
    };

    const sexData = {
      labels: ['Masculino', 'Feminino'],
      datasets: [{
        data: [maleCount, femaleCount],
        backgroundColor: ['#60A5FA', '#F472B6'],
      }]
    };

    const hPyloriData = {
      labels: ['Pré-operatório', 'Pós-operatório'],
      datasets: [{
        label: 'H. Pylori Positivo (%)',
        data: [
          totalPatients ? (hPyloriPreCount / totalPatients) * 100 : 0,
          totalPatients ? (hPyloriPosCount / totalPatients) * 100 : 0
        ],
        backgroundColor: '#EF4444',
      }]
    };

    return (
      <div className="space-y-8 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total de Pacientes" value={totalPatients} icon={<Users className="w-5 h-5" />} color="bg-accent-500" />
          <StatCard title="Bypass Gástrico" value={bypassCount} icon={<Activity className="w-5 h-5" />} color="bg-brand-600" />
          <StatCard title="Sleeve Gástrico" value={sleeveCount} icon={<Activity className="w-5 h-5" />} color="bg-brand-400" />
          <StatCard title="Colelitíase Pós" value={colelitiasePosCount} icon={<AlertCircle className="w-5 h-5" />} color="bg-amber-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ChartContainer title="Distribuição por Tipo de Cirurgia">
            <div className="h-64 flex justify-center">
              <Pie data={surgeryTypeData} options={{ maintainAspectRatio: false }} />
            </div>
          </ChartContainer>
          <ChartContainer title="Distribuição por Sexo">
            <div className="h-64 flex justify-center">
              <Pie data={sexData} options={{ maintainAspectRatio: false }} />
            </div>
          </ChartContainer>
          <ChartContainer title="Prevalência de H. Pylori (Pré x Pós)">
            <div className="h-64">
              <Bar data={hPyloriData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }} />
            </div>
          </ChartContainer>
          <ChartContainer title="Incidência de Colelitíase Pós-op">
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="text-5xl font-bold text-amber-600">
                {totalPatients ? ((colelitiasePosCount / totalPatients) * 100).toFixed(1) : 0}%
              </div>
              <p className="text-slate-500 text-center max-w-xs">
                Dos pacientes acompanhados desenvolveram cálculos na vesícula após a cirurgia.
              </p>
            </div>
          </ChartContainer>
        </div>
      </div>
    );
  };

  return (
    <>
      <AnimatePresence>
        {showTour && <Tour onFinish={handleFinishTour} />}
      </AnimatePresence>
      <div className="flex h-screen text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-slate-200/70 flex flex-col shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 rounded-xl brand-gradient shadow-lg shadow-brand-600/20">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight leading-tight">BariExtract</h1>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Pesquisa Bariátrica</p>
            </div>
          </div>

          <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
            <button
              onClick={() => setActiveTab('patients')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'patients' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Users className="w-4 h-4" />
              Pacientes
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'dashboard' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('sobre')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'sobre' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Info className="w-4 h-4" />
              Sobre
            </button>
          </div>

          {activeTab === 'patients' && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por código..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {activeTab === 'patients' ? (
            filteredPatients.length === 0 ? (
              <div className="text-center py-10">
                <ClipboardList className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Nenhum paciente coletado</p>
              </div>
            ) : (
              filteredPatients.map(patient => (
                <motion.div
                  layout
                  key={patient.id}
                  onClick={() => !isProcessing && handlePatientSelect(patient.id)}
                  className={`p-4 rounded-xl transition-all border ${
                    selectedPatientId === patient.id
                      ? 'bg-brand-50 border-brand-200 shadow-sm'
                      : isProcessing
                        ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-50'
                        : 'bg-white border-transparent hover:bg-slate-50 cursor-pointer'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedPatientId === patient.id ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm truncate w-40 font-mono tracking-tight">{patient.codigoAnonimizado}</h3>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{patient.tipoCirurgia || 'Identificação protegida'}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); !isProcessing && removePatient(patient.id); }}
                      disabled={isProcessing}
                      className={`p-1 transition-colors ${
                        isProcessing
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-slate-400 hover:text-red-500'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))
            )
          ) : activeTab === 'dashboard' ? (
            <div className="p-4 bg-accent-50 rounded-xl border border-accent-100">
              <h4 className="text-xs font-bold text-accent-700 uppercase mb-2">Resumo da Coorte</h4>
              <p className="text-[10px] text-accent-700/80 leading-relaxed">
                Visualize estatísticas agregadas de todos os pacientes cadastrados no sistema.
              </p>
            </div>
          ) : (
            <div className="p-4 bg-brand-50 rounded-xl border border-brand-100">
              <h4 className="text-xs font-bold text-brand-700 uppercase mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> Sobre o app
              </h4>
              <p className="text-[10px] text-brand-700/80 leading-relaxed">
                Entenda como o BariExtract funciona, como os dados são anonimizados e quais
                variáveis são coletadas.
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={downloadExcel}
            disabled={patients.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3 brand-gradient text-white rounded-xl font-semibold hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-600/20"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </button>
          <p className="text-[9px] text-slate-400 text-center mt-2">Excel sem nome ou prontuário — só o código anonimizado</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {isEditing && renderEditForm()}
        </AnimatePresence>
        <header className="h-16 bg-white/80 backdrop-blur-sm border-b border-slate-200/70 flex items-center justify-between px-8">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-400">BariExtract</span>
            <ChevronRight className="w-4 h-4 text-slate-300" />
            <span className="text-sm font-bold text-slate-900">
              {activeTab === 'dashboard' ? 'Dashboard Estatístico' : activeTab === 'sobre' ? 'O que é o BariExtract' : 'Gerenciamento de Pacientes'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {!isSupabaseConfigured() && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-100 rounded-full">
                <AlertCircle className="w-3 h-3 text-amber-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">DB Local (Offline)</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1 bg-brand-50 rounded-full">
              <div className="w-2 h-2 bg-brand-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">IA Ativa</span>
            </div>

            <button
              onClick={() => setShowTour(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-500 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
              title="Rever o tour de boas-vindas"
            >
              <HelpCircle className="w-4 h-4" />
              Tour
            </button>

            {/* User info and logout */}
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="flex flex-col items-end">
                <span className="text-sm font-medium text-slate-900">
                  {user?.email}
                </span>
                <span className="text-xs text-slate-400">
                  Online
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            {activeTab === 'dashboard' ? renderDashboard() : activeTab === 'sobre' ? <Sobre /> : (
              <div className="space-y-8">
                {/* Input Section */}
                <section className="bg-white rounded-2xl border border-slate-200/70 brand-shadow overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-accent-50 rounded-lg">
                        <FileText className="w-5 h-5 text-accent-600" />
                      </div>
                      <div>
                        <h2 className="font-bold text-slate-900">Novo Prontuário</h2>
                        <p className="text-xs text-slate-500">Cole o texto ou arraste o arquivo do paciente</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setCurrentRecord(`Paciente: João Silva, 45 anos.
Prontuário: 123456. Sexo: Masculino.
Cidade: Cuiabá-MT.
Peso Inicial: 130kg. Altura: 1,75m.
Comorbidades: HAS e DM2.
Cirurgia realizada em 10/01/2024: Bypass Gástrico.
Peso 40 dias PO: 115kg.
Apto para cirurgia após liberação da cardiologia e nutrição.`);
                          setCurrentFiles([]);
                        }}
                        className="text-[10px] font-bold uppercase tracking-wider text-brand-600 hover:bg-brand-50 px-3 py-1 rounded-lg transition-colors"
                      >
                        Usar Exemplo
                      </button>
                      <button 
                        onClick={handleProcess}
                        disabled={isProcessing || (!currentRecord.trim() && currentFiles.length === 0)}
                        className="flex items-center gap-2 px-6 py-2 brand-gradient text-white rounded-xl font-semibold hover:opacity-95 disabled:opacity-50 transition-all relative overflow-hidden shadow-lg shadow-emerald-600/20"
                      >
                        {isProcessing ? (
                          <>
                            {processingStage === 'revisando' ? (
                              <Edit3 className="w-4 h-4" />
                            ) : processingStage === 'anonimizando' ? (
                              <ShieldCheck className="w-4 h-4" />
                            ) : (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            )}
                            <span>
                              {processingStage === 'revisando'
                                ? `Revisando (${reviewIndex + 1}/${reviewQueue.length})`
                                : processingStage === 'anonimizando'
                                  ? 'Anonimizando...'
                                  : `Processando (${progress}%)`}
                            </span>
                            {retryStatus && (
                              <span className="text-xs text-amber-600 ml-2">
                                {retryStatus.includes('Retrying') ? '⏳' : '⚠️'} {retryStatus}
                              </span>
                            )}
                            {processingStage !== 'revisando' && (
                              <motion.div 
                                className="absolute bottom-0 left-0 h-1 bg-brand-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                              />
                            )}
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            <span>Extrair {currentFiles.length > 0 ? `${currentFiles.length} Prontuários` : 'Dados'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-6 space-y-4">
                    <AnimatePresence mode="wait">
                      {isProcessing ? (
                        <motion.div key="stepper" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                          <ProcessingStepper stage={processingStage} progress={progress} retryStatus={retryStatus} />
                          {processingStage === 'revisando' && reviewQueue.length > 0 && (
                            <ReviewCard
                              patient={reviewQueue[reviewIndex].patient}
                              index={reviewIndex}
                              total={reviewQueue.length}
                              onChange={updateReviewField}
                              onPrev={() => goToReviewIndex(reviewIndex - 1)}
                              onNext={() => goToReviewIndex(reviewIndex + 1)}
                              onDiscard={() => discardReviewPatient(reviewIndex)}
                              onConfirmAll={finalizeReview}
                              onCancelAll={cancelReview}
                            />
                          )}
                        </motion.div>
                      ) : (
                        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                              <div className="flex items-center gap-2 mb-1">
                                <AlertCircle className="w-3 h-3 text-amber-600" />
                                <span className="text-[10px] font-bold text-amber-800 uppercase">Lote</span>
                              </div>
                              <p className="text-[10px] text-amber-700">Você pode enviar múltiplos arquivos de uma vez para análise em lote.</p>
                            </div>
                            <div className="p-3 bg-accent-50 rounded-xl border border-accent-100">
                              <div className="flex items-center gap-2 mb-1">
                                <ShieldCheck className="w-3 h-3 text-accent-600" />
                                <span className="text-[10px] font-bold text-accent-700 uppercase">Anonimização</span>
                              </div>
                              <p className="text-[10px] text-accent-700/80">Cada paciente recebe um código anonimizado — o nome real nunca é exportado.</p>
                            </div>
                            <div className="p-3 bg-brand-50 rounded-xl border border-brand-100">
                              <div className="flex items-center gap-2 mb-1">
                                <Download className="w-3 h-3 text-brand-600" />
                                <span className="text-[10px] font-bold text-brand-800 uppercase">Exportação</span>
                              </div>
                              <p className="text-[10px] text-brand-700">Todos os dados processados serão incluídos no Excel final.</p>
                            </div>
                          </div>
                          {currentFiles.length === 0 && !currentRecord.trim() && (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                              <div className="flex items-center gap-2 mb-2">
                                <FileDown className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                                  Não tem um prontuário à mão para testar?
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mb-3">
                                Baixe um prontuário modelo — com dados 100% fictícios, no mesmo formato do serviço — e envie-o logo abaixo para ver a extração em ação.
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {SAMPLE_RECORDS.map((sample) => (
                                  <a
                                    key={sample.file}
                                    href={`${import.meta.env.BASE_URL}prontuarios-modelo/${sample.file}`}
                                    download
                                    className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg text-left hover:border-brand-400 hover:bg-brand-50/40 transition-all"
                                  >
                                    <Download className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
                                    <span className="text-[10px] font-semibold text-slate-700 leading-tight">{sample.label}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          <div
                            {...getRootProps()}
                            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                              isDragActive ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-400'
                            } ${currentFiles.length > 0 ? 'border-brand-500 bg-brand-50/30' : ''}`}
                          >
                            <input {...getInputProps()} />
                            {currentFiles.length > 0 ? (
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {currentFiles.map((file, idx) => (
                                  <div key={idx} className="flex items-center gap-2 p-2 bg-white border border-brand-100 rounded-lg shadow-sm">
                                    <FileText className="w-4 h-4 text-brand-600 flex-shrink-0" />
                                    <p className="text-[10px] font-medium text-slate-700 truncate">{file.name}</p>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentFiles(prev => prev.filter((_, i) => i !== idx));
                                      }}
                                      className="ml-auto text-red-400 hover:text-red-600"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                                <div className="flex items-center justify-center p-2 border border-dashed border-brand-200 rounded-lg text-brand-600">
                                  <Plus className="w-4 h-4" />
                                </div>
                              </div>
                            ) : (
                              <>
                                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                                <p className="text-sm text-slate-600">
                                  Arraste múltiplos arquivos .txt ou .pdf, ou clique para selecionar
                                </p>
                              </>
                            )}
                          </div>

                          {currentFiles.length === 0 && (
                            <textarea
                              className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all resize-none"
                              placeholder="Ou cole o conteúdo do prontuário aqui..."
                              value={currentRecord}
                              onChange={(e) => {
                                setCurrentRecord(e.target.value);
                                if (e.target.value.trim()) setCurrentFiles([]);
                              }}
                            />
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </section>

                {/* Results Section */}
                <AnimatePresence mode="wait">
                  {selectedPatient && selectedPatient.id ? (
                    <motion.section
                      key={`patient-${selectedPatient.id}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="bg-white rounded-2xl border border-slate-200/70 brand-shadow overflow-hidden"
                    >
                      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-brand-50 rounded-lg">
                            <CheckCircle2 className="w-5 h-5 text-brand-600" />
                          </div>
                          <div>
                            <h2 className="font-bold text-slate-900 font-mono">{selectedPatient.codigoAnonimizado}</h2>
                            <p className="text-xs text-slate-500">Dados extraídos com sucesso</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleEdit(selectedPatient)}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
                          >
                            <Edit3 className="w-3 h-3" />
                            Editar Dados
                          </button>
                        </div>
                      </div>

                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {/* Identification */}
                        <DataGroup title="Identificação">
                          <DataItem label="Sexo" value={selectedPatient?.sexo} />
                          <DataItem label="Idade 1ª Consulta" value={selectedPatient?.idadePrimeiraConsulta} />
                          <DataItem label="Município" value={selectedPatient?.municipio} />
                          <DataItem label="Estado Civil" value={selectedPatient?.estadoCivil} />
                          <DataItem label="Nº Filhos" value={selectedPatient?.numFilhos} />
                          <DataItem label="Escolaridade" value={selectedPatient?.escolaridade} />
                        </DataGroup>

                        {/* Pre-op */}
                        <DataGroup title="Antropometria Pré-op">
                          <DataItem label="Peso Inicial" value={selectedPatient?.pesoInicial} />
                          <DataItem label="Peso Último" value={selectedPatient?.pesoUltimoPreOp} />
                          <DataItem label="Variação Peso" value={selectedPatient?.variacaoPesoPreOp} />
                          <DataItem label="Altura" value={selectedPatient?.altura} />
                          <DataItem label="IMC Inicial" value={selectedPatient?.imcInicial} />
                          <DataItem label="Último IMC" value={selectedPatient?.ultimoIMC} />
                          <DataItem label="% Perda Peso" value={selectedPatient?.percentExcessoPesoPerdido} />
                          <DataItem label="Tipo Cirurgia" value={selectedPatient?.tipoCirurgia} />
                        </DataGroup>

                        {/* Comorbidities */}
                        <DataGroup title="Comorbidades">
                          <DataItem label="HAS" value={selectedPatient?.has} />
                          <DataItem label="DM2" value={selectedPatient?.dm2} />
                          <DataItem label="Dislipidemia" value={selectedPatient?.dislipidemia} />
                          <DataItem label="Esteatose" value={selectedPatient?.esteatoseHepatica} />
                          <DataItem label="Colelitíase Pré" value={selectedPatient?.colelitiasePre} />
                        </DataGroup>

                        {/* Labs & Exams */}
                        <DataGroup title="Exames Pré-operatórios">
                          <DataItem label="H. Pylori" value={selectedPatient?.hPyloriResultado} />
                          <DataItem label="EDA" value={selectedPatient?.edaResultado} />
                          <DataItem label="Colonoscopia?" value={selectedPatient?.fezColonoscopia} />
                          <DataItem label="Resultado Colono" value={selectedPatient?.resultadoColonoscopia} />
                          <DataItem label="USG Abdome" value={selectedPatient?.usgAbdome} />
                        </DataGroup>

                        {/* EDA Pós */}
                        <DataGroup title="EDA Pós-operatória">
                          <DataItem label="Data" value={selectedPatient?.edaPosData} />
                          <DataItem label="Tempo Pós" value={calculatePostOpTime(selectedPatient?.dataCirurgia || '', selectedPatient?.edaPosData || '')} />
                          <DataItem label="Urease" value={selectedPatient?.edaPosUrease} />
                          <DataItem label="H. Pylori" value={selectedPatient?.edaPosHPylori} />
                          <DataItem label="Achados" value={selectedPatient?.edaPosAchados} />
                          <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Comparativo EDA</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-[9px] text-slate-400">Pré</p>
                                <p className="text-[10px] font-medium truncate">{selectedPatient?.edaResultado || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-slate-400">Pós</p>
                                <p className="text-[10px] font-medium truncate">{selectedPatient?.edaPosAchados || 'N/A'}</p>
                              </div>
                            </div>
                          </div>
                        </DataGroup>

                        {/* USG Pós */}
                        <DataGroup title="USG Pós-operatório">
                          <DataItem label="Data" value={selectedPatient?.usgPosData} />
                          <DataItem label="Tempo Pós" value={calculatePostOpTime(selectedPatient?.dataCirurgia || '', selectedPatient?.usgPosData || '')} />
                          <DataItem label="Vesícula" value={selectedPatient?.usgPosVesicula} />
                          {selectedPatient?.usgPosVesicula?.toLowerCase().includes('coleli') && (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded text-[9px] font-bold uppercase">
                              <AlertCircle className="w-2 h-2" />
                              Desenvolveu Colelitíase
                            </div>
                          )}
                          <DataItem label="Observações" value={selectedPatient?.usgPosObservacoes} />
                        </DataGroup>

                        {/* Post-op Follow-up */}
                        <DataGroup title="Acompanhamento Pós">
                          <DataItem label="Peso 1 Ano" value={selectedPatient?.peso1AnoPO} />
                          <DataItem label="Complicações" value={selectedPatient?.complicacoesPO} />
                          <DataItem label="Adesão Supl." value={selectedPatient?.adesaoSuplementacao} />
                        </DataGroup>
                      </div>

                      <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                        <div>
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Observações Clínicas</h4>
                          <p className="text-sm text-slate-700 leading-relaxed">
                            {selectedPatient?.observacoesClinicas || 'Nenhuma observação relevante extraída.'}
                          </p>
                        </div>
                        {selectedPatient?.lastEditedAt && (
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Última Edição</p>
                            <p className="text-[10px] text-slate-500">{format(new Date(selectedPatient?.lastEditedAt || new Date()), 'dd/MM/yyyy HH:mm')}</p>
                          </div>
                        )}
                      </div>
                    </motion.section>
                  ) : (
                    <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                      <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-slate-400">Selecione ou adicione um paciente para ver os detalhes</h3>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </main>
      </div>

      </div>
    </>
  );
}

function DataGroup({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-brand-600 uppercase tracking-widest border-b border-brand-100 pb-2">{title}</h3>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

function DataItem({ label, value }: { label: string, value: string | null | undefined }) {
  const safeValue = value?.trim() || '';
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-xs text-slate-500 font-medium">{label}</span>
      <span className={`text-xs font-semibold truncate max-w-[150px] ${safeValue ? 'text-slate-900' : 'text-slate-300 italic'}`}>
        {safeValue || 'N/A'}
      </span>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: number | string, icon: React.ReactNode, color: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/70 brand-shadow hover:-translate-y-0.5 transition-transform duration-200">
      <div className="flex items-center gap-4">
        <div className={`p-3 ${color} text-white rounded-xl shadow-lg shadow-slate-900/10`}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function ChartContainer({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/70 brand-shadow">
      <h3 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
        <BarChartIcon className="w-4 h-4 text-brand-500" />
        {title}
      </h3>
      {children}
    </div>
  );
}

// Todas as variáveis que hoje são realmente extraídas pela IA E usadas em algum
// lugar do app (ficha do paciente, Excel exportado). Organizadas nas mesmas
// categorias da aba "Sobre" e das abas do Excel, para ficar consistente em
// todo o app. Alguns campos extras (exames laboratoriais, espirometria, ECO,
// risco pulmonar/CV, Clexane) ainda não aparecem aqui de propósito: eles são
// extraídos pela IA mas não são exibidos nem exportados em nenhum lugar do
// app hoje — se um dia passarem a ser usados, entram aqui também.
const EDITABLE_FIELD_SECTIONS: { title: string; fields: { key: keyof PatientData; label: string }[] }[] = [
  {
    title: 'Identificação e Perfil',
    fields: [
      { key: 'sexo', label: 'Sexo' },
      { key: 'dataPrimeiraConsulta', label: 'Data 1ª Consulta' },
      { key: 'municipio', label: 'Município' },
      { key: 'estadoCivil', label: 'Estado Civil' },
      { key: 'numFilhos', label: 'Nº Filhos' },
      { key: 'ocupacao', label: 'Ocupação' },
      { key: 'escolaridade', label: 'Escolaridade' },
      { key: 'cuidadorPosOp', label: 'Cuidador Pós-op' },
    ],
  },
  {
    title: 'Dados Cirúrgicos e Antropometria',
    fields: [
      { key: 'tipoCirurgia', label: 'Tipo Cirurgia' },
      { key: 'dataCirurgia', label: 'Data Cirurgia' },
      { key: 'dataEmissaoAIH', label: 'Data Emissão AIH' },
      { key: 'tempoProtocolo', label: 'Tempo Protocolo' },
      { key: 'idadeNaCirurgia', label: 'Idade na Cirurgia' },
      { key: 'pesoInicial', label: 'Peso Inicial' },
      { key: 'pesoUltimoPreOp', label: 'Peso Último Pré-op' },
      { key: 'variacaoPesoPreOp', label: 'Variação de Peso' },
      { key: 'altura', label: 'Altura' },
      { key: 'imcInicial', label: 'IMC Inicial' },
      { key: 'imcUltimoPreOp', label: 'IMC Último Pré-op' },
      { key: 'expectativaPeso', label: 'Expectativa de Peso' },
      { key: 'perdaEsperada', label: 'Perda Esperada (%)' },
    ],
  },
  {
    title: 'Hábitos e Aspectos Psicossociais',
    fields: [
      { key: 'tabagismo', label: 'Tabagismo' },
      { key: 'etilismo', label: 'Etilismo' },
      { key: 'atividadeFisicaPre', label: 'Atividade Física Pré' },
      { key: 'comerEmocional', label: 'Comer Emocional' },
      { key: 'autoavaliacaoPsicologica', label: 'Autoavaliação Psicológica' },
      { key: 'obesidadeDesde', label: 'Obesidade Desde' },
      { key: 'tentativasEmagrecimento', label: 'Tentativas de Emagrecimento' },
      { key: 'cirurgiasPrevias', label: 'Cirurgias Prévias' },
    ],
  },
  {
    title: 'Comorbidades',
    fields: [
      { key: 'has', label: 'HAS' },
      { key: 'dm2', label: 'DM2' },
      { key: 'dislipidemia', label: 'Dislipidemia' },
      { key: 'esteatoseHepatica', label: 'Esteatose Hepática' },
      { key: 'colelitiasePre', label: 'Colelitíase Pré' },
      { key: 'asma', label: 'Asma' },
      { key: 'outrasComorbidades', label: 'Outras Comorbidades' },
      { key: 'medicacoesEmUso', label: 'Medicações em Uso' },
    ],
  },
  {
    title: 'Exames Pré-operatórios',
    fields: [
      { key: 'hPyloriResultado', label: 'H. Pylori (resultado)' },
      { key: 'hPyloriSituacao', label: 'H. Pylori (situação)' },
      { key: 'edaResultado', label: 'EDA (resultado)' },
      { key: 'fezColonoscopia', label: 'Fez Colonoscopia?' },
      { key: 'resultadoColonoscopia', label: 'Resultado Colonoscopia' },
      { key: 'usgAbdome', label: 'USG Abdome' },
    ],
  },
  {
    title: 'EDA e USG Pós-operatório',
    fields: [
      { key: 'edaPosData', label: 'Data EDA Pós' },
      { key: 'edaPosUrease', label: 'Urease' },
      { key: 'edaPosHPylori', label: 'H. Pylori Pós' },
      { key: 'edaPosAchados', label: 'Achados EDA Pós' },
      { key: 'usgPosData', label: 'Data USG Pós' },
      { key: 'usgPosVesicula', label: 'Vesícula (USG Pós)' },
      { key: 'usgPosObservacoes', label: 'Observações USG Pós' },
    ],
  },
  {
    title: 'Acompanhamento Pós-operatório',
    fields: [
      { key: 'pesoPO9dias', label: 'Peso 9 dias' },
      { key: 'pesoPO40dias', label: 'Peso 40 dias' },
      { key: 'pesoPO4_5meses', label: 'Peso 4,5 meses' },
      { key: 'pesoPO5meses', label: 'Peso 5 meses' },
      { key: 'pesoPO7meses', label: 'Peso 7 meses' },
      { key: 'pesoPO11meses', label: 'Peso 11 meses' },
      { key: 'peso1AnoPO', label: 'Peso 1 Ano' },
      { key: 'ultimoIMC', label: 'Último IMC' },
      { key: 'perdaAbsoluta1Ano', label: 'Perda Absoluta 1 Ano' },
      { key: 'percentExcessoPesoPerdido', label: '% Excesso Perdido' },
      { key: 'atividadeFisica1AnoPO', label: 'Atividade Física 1 Ano' },
      { key: 'excessoPele', label: 'Excesso de Pele' },
      { key: 'complicacoesPO', label: 'Complicações' },
      { key: 'adesaoSuplementacao', label: 'Adesão Suplementação' },
      { key: 'altaCB', label: 'Alta CB' },
    ],
  },
];

// Prontuários modelo (dados 100% fictícios) disponíveis para download na
// tela de upload, para quem for testar o BariExtract sem ter um prontuário
// real em mãos (ex: avaliadores externos). Arquivos em public/prontuarios-modelo/.
const SAMPLE_RECORDS: { file: string; label: string }[] = [
  { file: 'prontuario-modelo-1-caso-simples.pdf', label: 'Modelo 1 — Caso simples' },
  { file: 'prontuario-modelo-2-caso-complexo.pdf', label: 'Modelo 2 — Caso complexo' },
  { file: 'prontuario-modelo-3-acompanhamento-parcial.pdf', label: 'Modelo 3 — Acompanhamento parcial' },
];

function EditField({ label, value, onChange }: { label: string, value: string | null | undefined, onChange: (v: string) => void }) {
  const safeValue = value?.trim() || '';
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">{label}</label>
      <input
        type="text"
        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
        value={safeValue}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

type ProcessingStage = 'anonimizando' | 'extraindo' | 'revisando' | 'finalizando' | 'completo' | null;

const PROCESSING_STEPS: { key: Exclude<ProcessingStage, null>; label: string; icon: React.ElementType }[] = [
  { key: 'extraindo', label: 'Extraindo dados', icon: Sparkles },
  { key: 'anonimizando', label: 'Anonimizando dados', icon: ShieldCheck },
  { key: 'revisando', label: 'Revisão clínica', icon: Edit3 },
  { key: 'finalizando', label: 'Finalizando processo', icon: Save },
  { key: 'completo', label: 'Extração completada', icon: CheckCircle2 },
];

function ProcessingStepper({ stage, progress, retryStatus }: { stage: ProcessingStage; progress: number; retryStatus: string }) {
  const currentIndex = PROCESSING_STEPS.findIndex(s => s.key === stage);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/60 via-white to-accent-50/40 p-6"
    >
      <div className="flex items-center justify-between">
        {PROCESSING_STEPS.map((step, idx) => {
          const isDone = currentIndex > idx;
          const isActive = idx === currentIndex;
          const Icon = step.icon;
          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center gap-2 flex-1">
                <div
                  className={`relative flex items-center justify-center w-11 h-11 rounded-full border-2 transition-all duration-300 ${
                    isDone
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : isActive
                        ? 'bg-white border-brand-500 text-brand-600 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]'
                        : 'bg-white border-slate-200 text-slate-300'
                  }`}
                >
                  {isDone ? (
                    <Check className="w-5 h-5" />
                  ) : isActive && step.key !== 'completo' && step.key !== 'revisando' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wide text-center leading-tight ${
                    isDone || isActive ? 'text-slate-900' : 'text-slate-300'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < PROCESSING_STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mb-6 rounded-full transition-all duration-500 ${isDone ? 'bg-brand-500' : 'bg-slate-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {stage === 'extraindo' && (
        <div className="mt-6">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
            <span>Processando com IA</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-white rounded-full overflow-hidden border border-brand-100">
            <motion.div
              className="h-full bg-brand-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: 'easeOut' }}
            />
          </div>
          {retryStatus && (
            <p className="mt-2 text-[11px] text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {retryStatus}
            </p>
          )}
        </div>
      )}

      {stage === 'revisando' && (
        <div className="mt-6 flex items-center justify-center gap-2 text-accent-700 text-xs font-bold uppercase tracking-wide">
          <Edit3 className="w-3.5 h-3.5" />
          Nenhum dado foi salvo ainda — confira abaixo antes de confirmar
        </div>
      )}

      {stage === 'completo' && (
        <div className="mt-6 flex items-center justify-center gap-2 text-brand-600 text-sm font-bold">
          <CheckCircle2 className="w-4 h-4" />
          Dados extraídos e salvos com segurança
        </div>
      )}
    </motion.div>
  );
}

// Revisão de um paciente do lote antes de gravar no banco. Tudo aqui é
// rascunho em memória — nada foi salvo ainda (nem o paciente, nem o nome
// real no gabarito). O nome real nunca aparece nesta tela, propositalmente.
function ReviewCard({
  patient,
  index,
  total,
  onChange,
  onPrev,
  onNext,
  onDiscard,
  onConfirmAll,
  onCancelAll,
}: {
  patient: PatientData;
  index: number;
  total: number;
  onChange: (field: keyof PatientData, value: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onDiscard: () => void;
  onConfirmAll: () => void;
  onCancelAll: () => void;
}) {
  const isLast = index === total - 1;

  return (
    <motion.div
      key={`review-${index}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200/70 brand-shadow bg-white overflow-hidden"
    >
      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-500 text-white flex items-center justify-center flex-shrink-0">
            <Edit3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Revisar antes de salvar</h3>
            <p className="text-xs text-slate-500">
              <span className="font-mono">{patient.codigoAnonimizado}</span> · Paciente {index + 1} de {total}
            </p>
          </div>
        </div>
        <button
          onClick={onCancelAll}
          className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-red-500 transition-colors px-2 py-1"
        >
          Cancelar tudo
        </button>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-h-[65vh] overflow-y-auto">
        {EDITABLE_FIELD_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-3">
            <h4 className="text-xs font-bold text-brand-600 uppercase tracking-widest">{section.title}</h4>
            {section.fields.map((f) => (
              <EditField
                key={f.key}
                label={f.label}
                value={patient[f.key]}
                onChange={(v) => onChange(f.key, v)}
              />
            ))}
          </div>
        ))}

        <div className="space-y-3 lg:col-span-4">
          <h4 className="text-xs font-bold text-brand-600 uppercase tracking-widest">Observações Clínicas</h4>
          <textarea
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 min-h-[80px]"
            value={patient.observacoesClinicas || ''}
            onChange={(e) => onChange('observacoesClinicas', e.target.value)}
          />
        </div>
      </div>

      <div className="p-5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onDiscard}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Descartar este paciente
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            disabled={index === 0}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          {!isLast && (
            <button
              onClick={onNext}
              className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onConfirmAll}
            className="flex items-center gap-2 px-6 py-2 brand-gradient text-white rounded-xl font-semibold hover:opacity-95 transition-all shadow-lg shadow-emerald-600/20"
          >
            <Check className="w-4 h-4" />
            Confirmar e Salvar {total > 1 ? `Todos (${total})` : ''}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
