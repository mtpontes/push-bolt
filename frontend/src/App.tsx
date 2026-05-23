import { useState, useCallback, useEffect } from 'react';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';
import { AuthContainer } from './components/AuthContainer';
import { useWebSocket } from './hooks/useWebSocket';
import { getIdToken, getCurrentUserEmail, signOut } from './services/authService';
import type { CreateMessageRequest } from './types/message';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [wsUrl, setWsUrl] = useState<string>('');
  const [apiUrl] = useState(() => {
    return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  });

  useEffect(() => {
    const checkGoogleHashAndLogin = () => {
      const hash = window.location.hash;
      if (hash && hash.includes('id_token=')) {
        const params = new URLSearchParams(hash.substring(1));
        const idToken = params.get('id_token');
        const accessToken = params.get('access_token');

        if (idToken && accessToken) {
          try {
            const base64Url = idToken.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
              window.atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
            );
            const payload = JSON.parse(jsonPayload);
            const username = payload['cognito:username'] || payload['sub'];
            const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID || 'mockclientid123';

            if (username) {
              localStorage.setItem(`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`, username);
              localStorage.setItem(`CognitoIdentityServiceProvider.${clientId}.${username}.idToken`, idToken);
              localStorage.setItem(`CognitoIdentityServiceProvider.${clientId}.${username}.accessToken`, accessToken);
              
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
          } catch (err) {
            console.error('Erro ao processar tokens do Google/Cognito:', err);
          }
        }
      }
    };

    const checkSession = async () => {
      checkGoogleHashAndLogin();
      const tokenJwt = await getIdToken();
      if (tokenJwt) {
        setIsAuthenticated(true);
        const rawWsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
        setWsUrl(`${rawWsUrl}?token=${tokenJwt}`);
      } else {
        setIsAuthenticated(false);
      }
    };

    checkSession();
  }, [isAuthenticated]);

  const handleIncomingMessage = useCallback((data: any) => {
    console.log('Real-time update:', data);
    if (data && data.type === 'delete_message') {
      window.dispatchEvent(new CustomEvent('delete-message-event', { detail: data.createdAt }));
    } else if (data && data.type === 'new_message' && data.message) {
      window.dispatchEvent(new CustomEvent('new-message-event', { detail: data.message }));
    } else {
      window.dispatchEvent(new CustomEvent('refresh-messages'));
    }
  }, []);

  useWebSocket(wsUrl, handleIncomingMessage);

  const handleSendText = async (text: string) => {
    const request: CreateMessageRequest = {
      type: 'text',
      content: text
    };

    try {
      const tokenJwt = await getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (tokenJwt) {
        headers['Authorization'] = `Bearer ${tokenJwt}`;
      }

      const response = await fetch(`${apiUrl}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });

      if (!response.ok) throw new Error('Failed to send message');

      await response.json();
      window.dispatchEvent(new CustomEvent('refresh-messages'));
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleLogout = () => {
    signOut();
    setIsAuthenticated(false);
    setWsUrl('');
  };

  if (isAuthenticated === null) {
    return (
      <div className="loading" style={{ marginTop: '20%', fontSize: '1.2rem' }}>
        Carregando sessão...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthContainer onAuthSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Push Bolt</h1>
        <div className="user-profile">
          <span className="user-email">{getCurrentUserEmail()}</span>
          <button className="logout-btn" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      <MessageList />

      <MessageInput onSendText={handleSendText} />
    </div>
  );
}

export default App;
