import React, { useState, useRef } from 'react';
import { uploadFile } from '../services/uploadService';

interface MessageInputProps {
    onSendText: (text: string) => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({ onSendText }) => {
    const [text, setText] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (text.trim()) {
            onSendText(text);
            setText('');
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            await uploadFile(file);
            window.dispatchEvent(new CustomEvent('refresh-messages'));
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Upload failed. Please try again.');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <form onSubmit={handleSubmit} className="message-input-form">
            <input 
                type="text" 
                value={text} 
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message or paste a link..."
                disabled={uploading}
                className="text-input"
            />
            <button type="submit" disabled={!text.trim() || uploading} className="send-btn">
                Send
            </button>
            <div className="file-upload-wrapper">
                <input 
                    type="file" 
                    onChange={handleFileChange} 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    id="file-upload"
                />
                <label htmlFor="file-upload" className={`upload-label ${uploading ? 'uploading' : ''}`}>
                    {uploading ? '⌛' : '📎'}
                </label>
            </div>
        </form>
    );
};
