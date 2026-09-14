import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  Sparkles,
  FileText,
  Edit3,
  Database,
  Lock,
  ChevronDown,
  Users,
  Stethoscope,
  Activity,
  Heart,
  FlaskConical,
  TrendingUp,
  BadgeCheck,
} from 'lucide-react';

const FLOW_STEPS = [
  {
    icon: FileText,
    title: 'Você cola ou envia o prontuário',
    text: 'Texto colado direto ou arquivo (PDF, imagem, texto) — pode ser um ou vários de uma vez.',
  },
  {
    icon: ShieldCheck,
    title: 'Um código anônimo é gerado',
    text: 'Antes de qualquer leitura do conteúdo, o paciente já recebe um código aleatório (ex: PAC-7F3K9), sem relação com o texto.',
  },
  {
    icon: Sparkles,
    title: 'A IA extrai os dados clínicos',
    text: 'O Google Gemini lê o texto e estrutura as variáveis da pesquisa — sem saber nada sobre nomes ou anonimização.',
  },
  {
    icon: Edit3,
    title: 'Você revisa antes de salvar',
    text: 'Nada é gravado ainda: você confere e corrige os dados extraídos, paciente por paciente.',
  },
  {
    icon: Database,
    title: 'Os dados anonimizados são salvos',
    text: 'Só o código e os dados clínicos vão para o banco de pesquisa. Nome e prontuário reais vão para um cofre separado.',
  },
];

const VARIABLE_CATEGORIES = [
  {
    icon: Users,
    title: 'Identificação e perfil',
    items: ['Sexo', 'Idade na 1ª consulta', 'Município', 'Estado civil', 'Nº de filhos', 'Ocupação', 'Escolaridade', 'Cuidador no pós-operatório'],
  },
  {
    icon: Activity,
    title: 'Dados cirúrgicos e antropometria',
    items: ['Tipo de cirurgia', 'Peso inicial e pré-operatório', 'Variação de peso', 'Altura', 'IMC inicial e pré-operatório', 'Expectativa e perda esperada de peso', 'Datas do protocolo (1ª consulta, emissão AIH, cirurgia)'],
  },
  {
    icon: Heart,
    title: 'Hábitos e aspectos psicossociais',
    items: ['Tabagismo e etilismo', 'Atividade física pré-operatória', 'Comer emocional', 'Autoavaliação psicológica', 'Tempo de obesidade', 'Tentativas de emagrecimento', 'Cirurgias prévias'],
  },
  {
    icon: Stethoscope,
    title: 'Comorbidades',
    items: ['Hipertensão (HAS)', 'Diabetes tipo 2', 'Dislipidemia', 'Esteatose hepática', 'Colelitíase pré-operatória', 'Asma', 'Outras comorbidades', 'Medicações em uso'],
  },
  {
    icon: FlaskConical,
    title: 'Exames pré-operatórios',
    items: ['H. pylori (resultado e situação)', 'EDA (resultado)', 'Colonoscopia (realização e resultado)', 'USG de abdome'],
  },
  {
    icon: TrendingUp,
    title: 'Acompanhamento pós-operatório',
    items: ['Peso em múltiplos momentos (9 dias a 1 ano)', 'Perda absoluta e % de excesso de peso perdido', 'Atividade física e excesso de pele', 'Complicações e adesão à suplementação', 'EDA e USG pós-operatórios', 'Observações clínicas'],
  },
];

function FlowStep({ step, index, total }: { step: typeof FLOW_STEPS[number]; index: number; total: number }) {
  const Icon = step.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: index * 0.08 }}
      className="flex-1 flex flex-col items-center text-center gap-3 relative"
    >
      {index < total - 1 && (
        <div className="hidden md:block absolute top-7 left-1/2 w-full h-0.5 bg-gradient-to-r from-brand-200 to-brand-100 -z-10" />
      )}
      <div className="w-14 h-14 rounded-2xl brand-gradient text-white flex items-center justify-center brand-shadow flex-shrink-0">
        <Icon className="w-6 h-6" />
      </div>
      <div className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">Passo {index + 1}</div>
      <h4 className="font-bold text-sm text-slate-900 leading-tight px-2">{step.title}</h4>
      <p className="text-xs text-slate-500 leading-relaxed px-2">{step.text}</p>
    </motion.div>
  );
}

function VariableAccordion({ category, isOpen, onToggle }: { category: typeof VARIABLE_CATEGORIES[number]; isOpen: boolean; onToggle: () => void }) {
  const Icon = category.icon;
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white overflow-hidden brand-shadow">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-slate-50/60 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm text-slate-900 truncate">{category.title}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="overflow-hidden"
      >
        <div className="px-5 pb-5 flex flex-wrap gap-2">
          {category.items.map((item) => (
            <span
              key={item}
              className="text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-3 py-1"
            >
              {item}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default function Sobre() {
  const [openCategory, setOpenCategory] = useState<number | null>(0);

  return (
    <div className="space-y-10 pb-16">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl overflow-hidden border border-slate-200/70 brand-shadow bg-gradient-to-br from-brand-50/70 via-white to-accent-50/50"
      >
        <div className="p-10 md:p-14 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl brand-gradient text-white brand-shadow mb-6">
            <Database className="w-7 h-7" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight mb-3">
            O que é o BariExtract?
          </h1>
          <p className="text-slate-600 leading-relaxed">
            Uma ferramenta criada para ajudar pesquisadores em cirurgia bariátrica a transformar
            prontuários em dados de pesquisa de forma rápida, organizada e segura — sem depender de
            preenchimento manual de planilha, prontuário por prontuário.
          </p>
        </div>
      </motion.section>

      {/* Por que existe */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        className="rounded-2xl border border-slate-200/70 brand-shadow bg-white p-8"
      >
        <h2 className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">Por que foi criado</h2>
        <p className="text-slate-700 leading-relaxed">
          Coletar dados de pesquisa a partir de prontuários manualmente é um processo lento e
          sofrido: são dezenas de variáveis por paciente, espalhadas em texto livre, copiadas
          uma a uma para uma planilha. O BariExtract nasceu para resolver exatamente esse
          gargalo — usando inteligência artificial para ler o prontuário e estruturar os dados
          automaticamente, liberando tempo do pesquisador para o que realmente importa: analisar
          os resultados e produzir ciência.
        </p>
      </motion.section>

      {/* Como funciona */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        className="rounded-2xl border border-slate-200/70 brand-shadow bg-white p-8"
      >
        <h2 className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-6">Como funciona</h2>
        <div className="flex flex-col md:flex-row gap-8 md:gap-4">
          {FLOW_STEPS.map((step, idx) => (
            <FlowStep key={step.title} step={step} index={idx} total={FLOW_STEPS.length} />
          ))}
        </div>
      </motion.section>

      {/* Segurança e anonimização */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/60 via-white to-accent-50/30 p-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-slate-900">Segurança e anonimização</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex gap-3">
            <BadgeCheck className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700 leading-relaxed">
              O nome do paciente e o número do prontuário nunca aparecem em nenhuma tela do
              BariExtract — nem na lista de pacientes, nem na ficha, nem na revisão antes de
              salvar. Em todo lugar, o paciente é identificado só pelo código anonimizado.
            </p>
          </div>
          <div className="flex gap-3">
            <BadgeCheck className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700 leading-relaxed">
              O nome e o prontuário reais vão para uma tabela separada (o "gabarito"), com uma
              regra de segurança no banco de dados que permite ao aplicativo <strong>gravar</strong> ali,
              mas nunca <strong>ler de volta</strong>. Só quem acessa o banco diretamente consegue ver.
            </p>
          </div>
          <div className="flex gap-3">
            <BadgeCheck className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700 leading-relaxed">
              A planilha Excel exportada para análise também não leva nome nem número de
              prontuário — só o código anonimizado e os dados clínicos da pesquisa.
            </p>
          </div>
          <div className="flex gap-3">
            <BadgeCheck className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700 leading-relaxed">
              O texto do prontuário enviado para a inteligência artificial não fica guardado em
              nenhum lugar do BariExtract depois da extração — ele existe só na memória do
              navegador durante o processamento e é descartado assim que os dados são salvos.
            </p>
          </div>
        </div>
      </motion.section>

      {/* Variáveis coletadas */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
      >
        <h2 className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-2">Variáveis coletadas</h2>
        <p className="text-sm text-slate-500 mb-5">
          Clique em uma categoria para ver exemplos das variáveis extraídas de cada prontuário.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {VARIABLE_CATEGORIES.map((category, idx) => (
            <VariableAccordion
              key={category.title}
              category={category}
              isOpen={openCategory === idx}
              onToggle={() => setOpenCategory(prev => prev === idx ? null : idx)}
            />
          ))}
        </div>
      </motion.section>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="text-center text-xs text-slate-400 pt-4 border-t border-slate-100"
      >
        <p>BariExtract — ferramenta de apoio à pesquisa científica em cirurgia bariátrica.</p>
        <p className="mt-1">Uso interno e institucional · dados tratados de forma anonimizada.</p>
      </motion.div>
    </div>
  );
}
