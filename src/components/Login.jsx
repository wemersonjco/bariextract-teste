import React, { useState } from 'react';
import { supabase } from '../services/examesSupabaseService';
import { Database, Eye, EyeOff, LogIn, ShieldCheck, KeyRound, UserPlus, Mail, CheckCircle2, ArrowLeft } from 'lucide-react';

// Código de convite exigido para criar conta (compartilhe apenas com quem for
// usar o sistema, ex: avaliadores da competição). Configurado em VITE_INVITE_CODE
// no .env / nas variáveis de ambiente do deploy - não fica hardcoded no código.
const INVITE_CODE = import.meta.env.VITE_INVITE_CODE;

const traduzErroSignup = (message) => {
  if (!message) return 'Erro ao criar conta. Tente novamente.';
  if (message.toLowerCase().includes('already registered') || message.toLowerCase().includes('already exists')) {
    return 'Este email já tem uma conta. Tente entrar em vez de criar uma nova.';
  }
  if (message.toLowerCase().includes('password')) {
    return 'A senha precisa ter pelo menos 6 caracteres.';
  }
  if (message.toLowerCase().includes('invalid') && message.toLowerCase().includes('email')) {
    return 'Email inválido.';
  }
  return 'Erro ao criar conta. Tente novamente.';
};

const Login = ({ onLogin }) => {
  // 'login' | 'signup' | 'signup-success'
  const [mode, setMode] = useState('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Campos exclusivos do cadastro
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [signupEmail, setSignupEmail] = useState('');

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setPassword('');
    setConfirmPassword('');
    setInviteCode('');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          // Se rememberMe estiver marcado, a sessão persistirá
          // Se não, a sessão expira ao fechar o navegador (comportamento padrão)
        }
      });

      if (error) {
        setError('Email ou senha inválidos');
      } else {
        // Login bem-sucedido
        onLogin(data.user);
      }
    } catch (err) {
      setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!INVITE_CODE) {
      setError('Cadastro indisponível: o código de convite não foi configurado no sistema (VITE_INVITE_CODE).');
      return;
    }
    if (inviteCode.trim() !== INVITE_CODE) {
      setError('Código de convite inválido.');
      return;
    }
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        setError(traduzErroSignup(error.message));
      } else if (data.session) {
        // Projeto sem confirmação de email obrigatória: já entra direto.
        onLogin(data.user);
      } else {
        // Confirmação de email obrigatória: aguarda o clique no link enviado.
        setSignupEmail(email);
        setMode('signup-success');
      }
    } catch (err) {
      setError('Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'signup-success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8FAF9]">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-3xl brand-shadow border border-slate-100 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl brand-gradient mb-4 shadow-lg shadow-emerald-600/20">
              <CheckCircle2 className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-2">Cadastro realizado!</h1>
            <p className="text-slate-500 text-sm leading-relaxed mb-1">
              Enviamos um link de confirmação para:
            </p>
            <p className="text-slate-900 font-semibold text-sm mb-4 break-all">{signupEmail}</p>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Abra seu email e clique no link para confirmar a conta. Depois disso, é só voltar
              aqui e entrar normalmente com seu email e senha.
            </p>
            <button
              onClick={() => switchMode('login')}
              className="w-full flex items-center justify-center gap-2 brand-gradient text-white py-3 px-4 rounded-xl font-semibold hover:opacity-95 transition duration-200 shadow-lg shadow-emerald-600/20"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para o login
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isSignup = mode === 'signup';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8FAF9]">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl brand-shadow border border-slate-100 p-8">
          {/* Logo/Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl brand-gradient mb-4 shadow-lg shadow-emerald-600/20">
              <Database className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">BariExtract</h1>
            <p className="text-slate-500 mt-2 text-sm">
              {isSignup ? 'Crie sua conta para acessar o sistema' : 'Extração inteligente de dados para pesquisa médica'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={isSignup ? handleSignupSubmit : handleLoginSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 outline-none transition"
                placeholder="seu@email.com"
                required
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 outline-none transition"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  minLength={isSignup ? 6 : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {isSignup && (
              <>
                {/* Confirmar senha */}
                <div>
                  <label htmlFor="confirmPassword" className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Confirmar senha
                  </label>
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 outline-none transition"
                    placeholder="••••••••"
                    required
                    disabled={loading}
                  />
                </div>

                {/* Código de convite */}
                <div>
                  <label htmlFor="inviteCode" className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Código de convite
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="inviteCode"
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 outline-none transition"
                      placeholder="Código fornecido por quem te convidou"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Remember Me - só faz sentido no login */}
            {!isSignup && (
              <div className="flex items-center">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                  disabled={loading}
                />
                <label htmlFor="remember" className="ml-2 block text-sm text-slate-600">
                  Lembrar de mim
                </label>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full brand-gradient text-white py-3 px-4 rounded-xl font-semibold hover:opacity-95 focus:ring-4 focus:ring-brand-500/20 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-emerald-600/20"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isSignup ? 'Criando conta...' : 'Entrando...'}
                </>
              ) : isSignup ? (
                <>
                  <UserPlus className="w-5 h-5 mr-2" />
                  Criar conta
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5 mr-2" />
                  Entrar
                </>
              )}
            </button>
          </form>

          {/* Toggle login/signup */}
          <div className="mt-5 text-center">
            {isSignup ? (
              <button
                onClick={() => switchMode('login')}
                className="text-sm text-slate-500 hover:text-brand-700 font-medium transition-colors"
                disabled={loading}
              >
                Já tem uma conta? <span className="text-brand-600 font-bold">Entrar</span>
              </button>
            ) : (
              <button
                onClick={() => switchMode('signup')}
                className="text-sm text-slate-500 hover:text-brand-700 font-medium transition-colors"
                disabled={loading}
              >
                Ainda não tem conta? <span className="text-brand-600 font-bold">Criar conta</span>
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            {isSignup ? <Mail className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            <span>
              {isSignup
                ? 'Cadastro protegido por código de convite'
                : 'Acesso restrito · dados de pacientes tratados de forma anonimizada'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
