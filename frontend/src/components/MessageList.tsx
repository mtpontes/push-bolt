import React from 'react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

export const MessageList: React.FC = () => {
    const { items, loading, hasMore, fetchNext, deleteMessage } = useInfiniteScroll();

    return (
        <div className="message-list-container">
            <div className="messages">
                {items.map((msg) => (
                    <div key={msg.messageId} className={`message-item ${msg.type}`}>
                        <div className="message-header">
                            <span className="timestamp">{new Date(msg.createdAt).toLocaleString()}</span>
                            <button 
                                onClick={() => deleteMessage(msg.createdAt)} 
                                className="delete-message-btn"
                                title="Deletar mensagem"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="message-body">
                            {msg.type === 'text' || msg.type === 'link' ? (
                                <p>{msg.content}</p>
                            ) : msg.type === 'image' ? (
                                <img src={msg.downloadUrl} alt={msg.fileName} className="message-image" />
                            ) : (
                                <a href={msg.downloadUrl} target="_blank" rel="noopener noreferrer" className="file-link">
                                    📄 {msg.fileName} ({Math.round((msg.sizeBytes || 0) / 1024)} KB)
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            
            {loading && <div className="loading">Loading messages...</div>}
            
            {hasMore && !loading && (
                <button onClick={fetchNext} className="load-more-btn">
                    Load More
                </button>
            )}
        </div>
    );
};
