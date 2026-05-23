import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWebSocket } from './useWebSocket';

describe('useWebSocket', () => {
    let mockWebSocket: any;

    beforeEach(() => {
        mockWebSocket = {
            send: vi.fn(),
            close: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            readyState: 1
        };
        const MockWS = vi.fn(function() { return mockWebSocket; });
        (MockWS as any).CONNECTING = 0;
        (MockWS as any).OPEN = 1;
        (MockWS as any).CLOSING = 2;
        (MockWS as any).CLOSED = 3;
        vi.stubGlobal('WebSocket', MockWS);


    });

    it('should connect to the given url', () => {
        const url = 'ws://localhost:8080';
        renderHook(() => useWebSocket(url, () => {}));

        expect(window.WebSocket).toHaveBeenCalledWith(url);
    });

    it('should call the callback when a message is received', () => {
        const onMessage = vi.fn();
        renderHook(() => useWebSocket('ws://localhost:8080', onMessage));

        // Get the message event listener
        const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
            (call: any) => call[0] === 'message'
        )[1];

        const event = { data: JSON.stringify({ type: 'text', content: 'hello' }) };
        act(() => {
            messageHandler(event);
        });

        expect(onMessage).toHaveBeenCalledWith({ type: 'text', content: 'hello' });
    });

    it('should close the connection on unmount', () => {
        const { unmount } = renderHook(() => useWebSocket('ws://localhost:8080', () => {}));
        unmount();
        expect(mockWebSocket.close).toHaveBeenCalled();
    });
});
