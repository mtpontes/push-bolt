import React, { useState } from 'react';
import { signIn, signUp, confirmSignUp, getGoogleLoginUrl } from '../services/authService';
import './AuthContainer.css';

interface AuthContainerProps {
  onAuthSuccess: () => void;
}

type AuthMode = 'login' | 'register' | 'confirm';

export const AuthContainer: React.FC<AuthContainerProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearForm = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      await signIn(email, password);
      onAuthSuccess();
    } catch (err: any) {
      console.error('Sign in error:', err);
      if (err.code === 'UserNotConfirmedException') {
        setError('Sua conta não foi confirmada. Verifique seu e-mail.');
        setMode('confirm');
      } else {
        setError(err.message || 'Falha ao entrar. Verifique suas credenciais.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await signUp(email, password);
      setSuccessMessage('Conta criada! Código de confirmação enviado ao seu e-mail.');
      setMode('confirm');
    } catch (err: any) {
      console.error('Sign up error:', err);
      setError(err.message || 'Erro ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !code) {
      setError('Por favor, preencha seu e-mail e o código recebido.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await confirmSignUp(email, code);
      setSuccessMessage('E-mail confirmado com sucesso! Agora você pode fazer login.');
      setMode('login');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Confirmation error:', err);
      setError(err.message || 'Código de confirmação inválido.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    try {
      const googleLoginUrl = getGoogleLoginUrl();
      window.location.href = googleLoginUrl;
    } catch (err: any) {
      console.error('Erro ao redirecionar para o Google:', err);
      setError('Falha ao iniciar autenticação do Google.');
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <h2>PushBolt</h2>
          <p>Sincronização multi-dispositivo em tempo real</p>
        </div>

        {error && (
          <div className="auth-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="auth-success">
            {successMessage}
          </div>
        )}

        {mode === 'login' && (
          <form className="auth-form" onSubmit={handleSignIn}>
            <div className="form-group">
              <label htmlFor="login-email">E-mail</label>
              <input
                id="login-email"
                type="email"
                className="form-input"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="login-password">Senha</label>
              <input
                id="login-password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <div className="divider">ou continuar com</div>

            <button type="button" className="social-auth-btn" onClick={handleGoogleLogin} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              Google
            </button>

            <div className="auth-switch">
              Não tem uma conta?{' '}
              <span
                className="auth-link"
                onClick={() => {
                  setMode('register');
                  clearForm();
                }}
              >
                Cadastre-se
              </span>
            </div>
          </form>
        )}

        {mode === 'register' && (
          <form className="auth-form" onSubmit={handleSignUp}>
            <div className="form-group">
              <label htmlFor="reg-email">E-mail</label>
              <input
                id="reg-email"
                type="email"
                className="form-input"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="reg-password">Senha</label>
              <input
                id="reg-password"
                type="password"
                className="form-input"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="reg-confirm-password">Confirmar Senha</label>
              <input
                id="reg-confirm-password"
                type="password"
                className="form-input"
                placeholder="Digite a senha novamente"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </button>

            <div className="auth-switch">
              Já tem uma conta?{' '}
              <span
                className="auth-link"
                onClick={() => {
                  setMode('login');
                  clearForm();
                }}
              >
                Entrar
              </span>
            </div>
          </form>
        )}

        {mode === 'confirm' && (
          <form className="auth-form" onSubmit={handleConfirm}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem', textAlign: 'center' }}>
              Insira o código enviado para <strong>{email}</strong>
            </p>
            
            <div className="form-group">
              <label htmlFor="confirm-email">Confirme seu E-mail</label>
              <input
                id="confirm-email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirm-code">Código de Confirmação</label>
              <input
                id="confirm-code"
                type="text"
                className="form-input"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={loading}
              />
            </div>

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Confirmando...' : 'Confirmar Conta'}
            </button>

            <div className="auth-switch">
              Quer voltar ao{' '}
              <span
                className="auth-link"
                onClick={() => {
                  setMode('login');
                  clearForm();
                }}
              >
                Login
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
