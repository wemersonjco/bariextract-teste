import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  MapPin,
  Upload,
  ShieldCheck,
  Sparkles,
  LayoutDashboard,
  FileDown,
  Rocket,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
} from 'lucide-react';

interface TourStep {
  icon: React.ComponentType<{ className?: string }>;
  badge: string;
  title: string;
  text: string;
  warning?: string;
  cta?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    icon: MapPin,
    badge: 'Contexto',
    title: 'Feito para o maior programa de cirurgia bariátrica de Mato Grosso',
    text: 'O BariExtract foi construído em cima do protocolo de pesquisa do serviço de cirurgia bariátrica que hoje é o maior programa do tipo no estado de Mato Grosso. Cada variável extraída, cada abreviação reconhecida pela IA e cada etapa do fluxo foram pensadas especificamente para esse protocolo.',
    warning: 'Para usar em outro serviço ou protocolo de pesquisa, é necessário adaptar as variáveis extraídas e o prompt da IA à realidade local — o sistema não foi feito para ser genérico.',
  },
  {
    icon: Upload,
    badge: 'Envio do prontuário',
    title: 'Cole o texto ou envie o arquivo — um ou vários de uma vez',
    text: 'Na tela de envio, você pode colar o texto do prontuário diretamente ou enviar arquivos (PDF, imagem ou texto), inclusive vários pacientes de uma só vez. Não tem um prontuário à mão para testar? Essa mesma tela oferece prontuários modelo, com dados 100% fictícios no mesmo formato do serviço.',
  },
  {
    icon: ShieldCheck,
    badge: 'Anonimização',
    title: 'Um código anônimo nasce antes da IA ler qualquer coisa',
    text: 'Assim que o prontuário entra no sistema, o paciente já recebe um código aleatório (ex: PAC-7F3K9), sem nenhuma relação com o conteúdo do texto. É esse código — nunca o nome ou o número do prontuário — que aparece em toda tela do BariExtract, da ficha do paciente à planilha exportada.',
  },
  {
    icon: Sparkles,
    badge: 'Extração e revisão',
    title: 'A IA estrutura os dados — você confere antes de salvar',
    text: 'O Google Gemini lê o texto e organiza dezenas de variáveis da pesquisa automaticamente. Nada é gravado ainda nesse momento: você revisa e pode corrigir qualquer campo, paciente por paciente, antes de confirmar o salvamento.',
  },
  {
    icon: LayoutDashboard,
    badge: 'Pacientes e Dashboard',
    title: 'Acompanhe cada paciente e a coorte inteira',
    text: 'Na aba Pacientes você busca, revisa e edita a ficha de cada paciente pelo código anonimizado. Na aba Dashboard, veja estatísticas agregadas de toda a coorte — perfil, comorbidades, evolução de peso e outros indicadores — atualizadas automaticamente a cada novo paciente.',
  },
  {
    icon: FileDown,
    badge: 'Exportação',
    title: 'Exporte tudo em Excel, pronto para a análise',
    text: 'Com um clique, gere uma planilha Excel com os dados anonimizados de todos os pacientes, organizada em múltiplas abas — sem nome nem número de prontuário. É esse arquivo que segue para a análise estatística da pesquisa.',
  },
  {
    icon: Rocket,
    badge: 'Pronto para começar',
    title: 'Você já conhece o BariExtract',
    text: 'Pode rever este tour a qualquer momento clicando no ícone de ajuda no topo da tela. Para entender em detalhes como funciona a anonimização e quais variáveis são coletadas, visite a aba Sobre quando quiser.',
    cta: 'Começar a usar',
  },
];

export default function Tour({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const total = TOUR_STEPS.length;
  const current = TOUR_STEPS[step];
  const Icon = current.icon;
  const isLast = step === total - 1;

  const goNext = () => {
    if (isLast) {
      onFinish();
    } else {
      setStep((s) => s + 1);
    }
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-xl bg-white rounded-3xl overflow-hidden brand-shadow"
      >
        <button
          onClick={onFinish}
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          Pular tour
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="p-10 pt-14">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-14 h-14 rounded-2xl brand-gradient text-white flex items-center justify-center brand-shadow mb-6">
                <Icon className="w-6 h-6" />
              </div>
              <div className="text-[10px] font-bold text-brand-600 uppercase tracking-widest mb-2">
                {current.badge} · {step + 1}/{total}
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-3 leading-snug">
                {current.title}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">{current.text}</p>

              {current.warning && (
                <div className="mt-4 flex gap-2.5 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed">{current.warning}</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between px-10 pb-8">
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setStep(idx)}
                aria-label={`Ir para o passo ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === step ? 'w-6 bg-brand-500' : 'w-1.5 bg-slate-200 hover:bg-slate-300'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={goBack}
                className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Voltar
              </button>
            )}
            <button
              onClick={goNext}
              className="flex items-center gap-1.5 px-5 py-2.5 brand-gradient text-white text-xs font-bold rounded-xl hover:opacity-95 transition-all shadow-lg shadow-brand-600/20"
            >
              {current.cta || 'Próximo'}
              {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
