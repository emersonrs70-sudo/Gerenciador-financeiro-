import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  Lock, 
  Mail, 
  User as UserIcon, 
  BrainCircuit, 
  ArrowRight, 
  Sparkles,
  ShieldCheck,
  Globe,
  Database
} from 'lucide-react';
import { supabase, testConnection } from '../lib/supabase';

interface AuthScreenProps {
  onLoginSuccess: (user: { email: string; name: string }) => void;
  isOnline: boolean;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess, isOnline }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [useLocalOnly, setUseLocalOnly] = useState(false);

  const validateEmail = (emailStr: string) => {
    return /\S+@\S+\.\S+/.test(emailStr);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!trimmedEmail) {
      setErrorMsg('Por favor, informe seu email.');
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      setErrorMsg('Por favor, digite um formato de email válido.');
      return;
    }
    if (!password || password.length < 4) {
      setErrorMsg('Sua senha deve possuir pelo menos 4 caracteres.');
      return;
    }
    if (!isLogin && !trimmedName) {
      setErrorMsg('Por favor, informe o seu nome para cadastro.');
      return;
    }

    setLoading(true);

    // Local Sandbox Mode fallback
    if (useLocalOnly || !isOnline) {
      setTimeout(() => {
        setLoading(false);
        if (isLogin) {
          // Check local users registered in localstorage
          const localUsers = JSON.parse(localStorage.getItem('local_registered_users') || '{}');
          if (localUsers[trimmedEmail]) {
            if (localUsers[trimmedEmail].password === password) {
              onLoginSuccess({ email: trimmedEmail, name: localUsers[trimmedEmail].name });
            } else {
              setErrorMsg('Senha incorreta para esta conta local.');
            }
          } else {
            // For frictionless access, we can auto-register in offline mode if they just log in,
            // or let them sign up. Let's ask them to click Sign Up first
            setErrorMsg('Conta local não cadastrada. Altere para "Criar Conta" para criar uma.');
          }
        } else {
          const localUsers = JSON.parse(localStorage.getItem('local_registered_users') || '{}');
          localUsers[trimmedEmail] = { name: trimmedName, password };
          localStorage.setItem('local_registered_users', JSON.stringify(localUsers));
          
          setSuccessMsg('Conta local criada com sucesso! Redirecionando...');
          setTimeout(() => {
            onLoginSuccess({ email: trimmedEmail, name: trimmedName });
          }, 1200);
        }
      }, 800);
      return;
    }

    try {
      if (isLogin) {
        // --- LOGIN ON SUPABASE ---
        const { data, error } = await supabase
          .from('fin_despesas')
          .select('*')
          .ilike('descricao', `__profile__ | email:${trimmedEmail} |%`);

        if (error) {
          console.error('Supabase query error:', error);
          throw new Error(`Falha ao consultar base de dados do Supabase (${error.message || error.details || 'Sem detalhes'}). Verifique se as tabelas existem e se as políticas de segurança (RLS) estão corretas.`);
        }

        if (data && data.length > 0) {
          const desc = data[0].descricao;
          const pwdMatch = desc.match(/\| name:(.*?) \| password:(.*)/);
          if (pwdMatch) {
            const savedName = pwdMatch[1].trim();
            const savedPwd = pwdMatch[2].trim();
            if (savedPwd === password) {
              setSuccessMsg(`Bem-vindo de volta, ${savedName}! Carregando painel exclusivo...`);
              setTimeout(() => {
                onLoginSuccess({ email: trimmedEmail, name: savedName });
              }, 1200);
            } else {
              setErrorMsg('Credenciais incorretas. Verifique a senha digitada.');
            }
          } else {
            setErrorMsg('Perfil de usuário corrompido na nuvem.');
          }
        } else {
          // Try to see if this is emersonrs70@gmail.com and let him in automatically to migrate
          if (trimmedEmail === 'emersonrs70@gmail.com' && password === '1234') {
            // Register automatically as the master account migration
            await supabase.from('fin_despesas').insert([{
              id: crypto.randomUUID(),
              descricao: `__profile__ | email:${trimmedEmail} | name:Emerson | password:${password}`,
              valor: 0,
              data: '2000-01-01',
              categoria: 'Sistema'
            }]);
            onLoginSuccess({ email: trimmedEmail, name: 'Emerson' });
          } else {
            setErrorMsg('Nenhuma conta encontrada com este email. Deseja criar uma conta?');
          }
        }
      } else {
        // --- SIGN UP ON SUPABASE ---
        // Check if user already exists
        const { data: existing, error: checkError } = await supabase
          .from('fin_despesas')
          .select('*')
          .ilike('descricao', `__profile__ | email:${trimmedEmail} |%`);

        if (checkError) {
          console.error('Supabase check error during signup:', checkError);
          throw new Error(`Erro ao validar existência da conta no Supabase: ${checkError.message || 'Sem mensagem'} (${checkError.code || ''})`);
        }

        if (existing && existing.length > 0) {
          setErrorMsg('Este email já está cadastrado no sistema FintechCore.');
          setLoading(false);
          return;
        }

        // Insert new profile record
        const { error: insertError } = await supabase
          .from('fin_despesas')
          .insert([{
            id: crypto.randomUUID(),
            descricao: `__profile__ | email:${trimmedEmail} | name:${trimmedName} | password:${password}`,
            valor: 0,
            data: '2000-01-01',
            categoria: 'Sistema'
          }]);

        if (insertError) {
          console.error('Supabase insert error during signup:', insertError);
          throw new Error(`Falha ao registrar novo perfil no servidor: ${insertError.message || 'Sem mensagem'} (${insertError.code || ''}). ${insertError.details || ''} ${insertError.hint || ''}`);
        }

        setSuccessMsg('Cadastro realizado com sucesso! Inicializando seu cofre...');
        setTimeout(() => {
          onLoginSuccess({ email: trimmedEmail, name: trimmedName });
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado no fluxo de autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      
      {/* Dynamic Ambient Background Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10 space-y-6">
        
        {/* LOGO TITLE HEADER */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl mb-2 text-purple-400">
            <BrainCircuit className="w-10 h-10 animate-pulse" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-1.5 font-sans">
            FintechCore
            <span className="text-[10px] uppercase font-black px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-md">
              v2.1
            </span>
          </h1>
          <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">
            Seu cofre financeiro de alta performance, agora inteligente e multiusuário.
          </p>
        </div>

        {/* AUTH CARD */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative">
          
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <h2 className="text-sm font-black text-white">
              {isLogin ? 'Acessar Meu Cofre' : 'Cadastrar Novo Acesso'}
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
              <span>{isOnline ? 'Supabase Conectado' : 'Modo Offline'}</span>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            
            {/* NAME FIELD (Sign Up Only) */}
            <AnimatePresence initial={false}>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-1"
                >
                  <label className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Seu Nome</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Ex: Emerson Silva"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-slate-600"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* EMAIL FIELD */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Endereço de Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-500" />
                <input
                  type="email"
                  placeholder="seuemail@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* PASSWORD FIELD */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Senha de Acesso</label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-500" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* STATUS / ERROR / SUCCESS FEEDBACKS */}
            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold">
                ⚠️ {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-bold">
                {successMsg}
              </div>
            )}

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-500 active:scale-98 text-white py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-purple-900/30 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Entrar com Segurança' : 'Criar Minha Conta'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* TOGGLE AUTH MODE LINK */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-slate-400 hover:text-purple-400 text-xs font-bold transition-all cursor-pointer hover:underline"
              >
                {isLogin ? 'Novo por aqui? Crie um acesso exclusivo' : 'Já possui conta? Acesse agora'}
              </button>
            </div>
          </form>

          {/* SANDBOX / LOCAL ONLY MODE TOGGLE */}
          {!isOnline && (
            <div className="mt-5 pt-4 border-t border-slate-800 text-center">
              <p className="text-[10px] text-amber-500 font-bold mb-2">
                O servidor está temporariamente indisponível. Deseja usar o sistema no Sandbox Local?
              </p>
              <button
                onClick={() => {
                  setUseLocalOnly(true);
                  setErrorMsg('');
                  setSuccessMsg('Sandbox Local ativado! Informe seu email para prosseguir.');
                }}
                className="text-[10px] bg-slate-950 hover:bg-slate-850 text-slate-350 px-3 py-1.5 rounded-xl border border-slate-800 font-black uppercase transition-all cursor-pointer"
              >
                Ativar Sandbox Local 🌿
              </button>
            </div>
          )}
        </div>

        {/* SECURITY FOOTER */}
        <div className="flex items-center justify-center gap-4 text-[10px] text-slate-500 font-bold">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
            Dados isolados
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Database className="w-3.5 h-3.5 text-indigo-500" />
            Supabase Cloud Core
          </span>
        </div>
      </div>
    </div>
  );
};
