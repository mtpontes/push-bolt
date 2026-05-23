import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MessageList } from './MessageList';
import * as hooks from '../hooks/useInfiniteScroll';

vi.mock('../hooks/useInfiniteScroll');

describe('MessageList', () => {
    it('should render a list of messages', () => {
        const mockItems = [
            { messageId: '1', content: 'Hello 1', type: 'text', createdAt: '2023-01-01' },
            { messageId: '2', content: 'Hello 2', type: 'text', createdAt: '2023-01-02' }
        ];

        (hooks.useInfiniteScroll as any).mockReturnValue({
            items: mockItems,
            loading: false,
            hasMore: false,
            fetchNext: vi.fn()
        });

        render(<MessageList />);

        expect(screen.getByText('Hello 1')).toBeInTheDocument();
        expect(screen.getByText('Hello 2')).toBeInTheDocument();
    });

    it('should show loading state', () => {
        (hooks.useInfiniteScroll as any).mockReturnValue({
            items: [],
            loading: true,
            hasMore: false,
            fetchNext: vi.fn()
        });

        render(<MessageList />);
        expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should call fetchNext when Load More is clicked', () => {
        const fetchNext = vi.fn();
        (hooks.useInfiniteScroll as any).mockReturnValue({
            items: [],
            loading: false,
            hasMore: true,
            fetchNext
        });

        render(<MessageList />);
        const button = screen.getByRole('button', { name: /load more/i });
        fireEvent.click(button);

        expect(fetchNext).toHaveBeenCalled();
    });
});
