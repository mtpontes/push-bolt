import { useState, useEffect, useCallback } from 'react';
import type { MessageItem, ListMessagesResponse } from '../types/message';
import { getIdToken } from '../services/authService';

export function useInfiniteScroll() {
    const [items, setItems] = useState<MessageItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [nextToken, setNextToken] = useState<string | undefined>(undefined);
    const [hasMore, setHasMore] = useState(false);

    const fetchMessages = useCallback(async (token?: string) => {
        setLoading(true);
        try {
            const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
            const url = token 
                ? `${apiUrl}/messages?nextToken=${encodeURIComponent(token)}`
                : `${apiUrl}/messages`;
            
            const tokenJwt = await getIdToken();
            const headers: Record<string, string> = {};
            if (tokenJwt) {
                headers['Authorization'] = `Bearer ${tokenJwt}`;
            }

            const response = await fetch(url, { headers });
            if (!response.ok) throw new Error('Failed to fetch messages');
            
            const data: ListMessagesResponse = await response.json();
            
            setItems(prev => token ? [...prev, ...data.items] : data.items);
            setNextToken(data.nextToken || undefined);
            setHasMore(!!data.nextToken);
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMessages();
    }, [fetchMessages]);

    useEffect(() => {
        const handleRefresh = () => {
            fetchMessages();
        };
        window.addEventListener('refresh-messages', handleRefresh);
        return () => {
            window.removeEventListener('refresh-messages', handleRefresh);
        };
    }, [fetchMessages]);

    const fetchNext = useCallback(() => {
        if (!loading && hasMore && nextToken) {
            fetchMessages(nextToken);
        }
    }, [loading, hasMore, nextToken, fetchMessages]);

    useEffect(() => {
        const handleDeleteEvent = (e: Event) => {
            const createdAt = (e as CustomEvent).detail;
            if (createdAt) {
                setItems(prev => prev.filter(item => item.createdAt !== createdAt));
            }
        };
        window.addEventListener('delete-message-event', handleDeleteEvent);
        return () => {
            window.removeEventListener('delete-message-event', handleDeleteEvent);
        };
    }, []);

    useEffect(() => {
        const handleNewMessageEvent = (e: Event) => {
            const message = (e as CustomEvent).detail as MessageItem;
            if (message) {
                setItems(prev => {
                    if (prev.some(item => item.messageId === message.messageId)) {
                        return prev;
                    }
                    return [message, ...prev];
                });
            }
        };
        window.addEventListener('new-message-event', handleNewMessageEvent);
        return () => {
            window.removeEventListener('new-message-event', handleNewMessageEvent);
        };
    }, []);

    const deleteMessage = useCallback(async (createdAt: string) => {
        setItems(prev => prev.filter(item => item.createdAt !== createdAt));
        try {
            const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
            const tokenJwt = await getIdToken();
            const headers: Record<string, string> = {};
            if (tokenJwt) {
                headers['Authorization'] = `Bearer ${tokenJwt}`;
            }

            const response = await fetch(`${apiUrl}/messages/${encodeURIComponent(createdAt)}`, {
                method: 'DELETE',
                headers
            });
            if (!response.ok) {
                fetchMessages();
                throw new Error('Failed to delete message');
            }
        } catch (error) {
            console.error('Error deleting message:', error);
        }
    }, [fetchMessages]);

    return {
        items,
        loading,
        hasMore,
        fetchNext,
        deleteMessage
    };
}
