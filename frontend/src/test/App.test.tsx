import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { useWebSocket } from '../hooks/useWebSocket';

// Mock components and hooks
vi.mock('../components/MessageList', () => ({
  MessageList: () => <div data-testid="message-list" />
}));

vi.mock('../components/MessageInput', () => ({
  MessageInput: () => <div data-testid="message-input" />
}));

vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    sendMessage: vi.fn(),
    isConnected: true
  }))
}));

vi.mock('../services/authService', () => ({
  getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
  getCurrentUserEmail: vi.fn().mockReturnValue('test@user.com'),
  signOut: vi.fn()
}));

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_API_URL', 'http://api.local');
    vi.stubEnv('VITE_WS_URL', 'ws://ws.local');
  });

  it('should initialize WebSocket with URL from environment variable', async () => {
    // Arrange & Act
    render(<App />);

    // Assert
    await waitFor(() => {
      expect(useWebSocket).toHaveBeenCalledWith('ws://ws.local?token=mock-id-token', expect.any(Function));
    });
  });

  it('should use API URL from environment variable for fetch', async () => {
    // Arrange
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messageId: '123' })
    } as Response);

    // Act
    render(<App />);

    // Assert
    const element = await screen.findByText('Push Bolt');
    expect(element).toBeInTheDocument();
  });
});
