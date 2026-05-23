import { renderHook, waitFor, act } from '@testing-library/react';

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { useInfiniteScroll } from './useInfiniteScroll';
import type { ListMessagesResponse } from '../types/message';

const mockMessages: ListMessagesResponse = {
    items: [
        {
            messageId: '1',
            userId: 'user-1',
            createdAt: '2023-01-01T00:00:00Z',
            type: 'text',
            content: 'Hello 1'
        },
        {
            messageId: '2',
            userId: 'user-1',
            createdAt: '2023-01-01T00:00:01Z',
            type: 'text',
            content: 'Hello 2'
        }
    ],
    nextToken: 'token-1'
};

const server = setupServer(
    http.get('*/messages', ({ request }) => {
        const url = new URL(request.url);
        const nextToken = url.searchParams.get('nextToken');

        if (nextToken === 'token-1') {
            return HttpResponse.json({
                items: [
                    {
                        messageId: '3',
                        userId: 'user-1',
                        createdAt: '2023-01-01T00:00:02Z',
                        type: 'text',
                        content: 'Hello 3'
                    }
                ],
                nextToken: null
            });
        }

        return HttpResponse.json(mockMessages);
    })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('useInfiniteScroll', () => {
    it('should load initial messages', async () => {
        const { result } = renderHook(() => useInfiniteScroll());

        expect(result.current.loading).toBe(true);

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.items).toHaveLength(2);
        expect(result.current.items[0].messageId).toBe('1');
        expect(result.current.hasMore).toBe(true);
    });

    it('should load more messages when fetchNext is called', async () => {
        const { result } = renderHook(() => useInfiniteScroll());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            result.current.fetchNext();
        });

        await waitFor(() => {
            expect(result.current.items).toHaveLength(3);
        });

        expect(result.current.items[2].messageId).toBe('3');
        expect(result.current.hasMore).toBe(false);
    });
});
