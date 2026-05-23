import type { GenerateUploadUrlRequest, GenerateUploadUrlResponse, CreateMessageRequest } from '../types/message';
import { getIdToken } from './authService';

export async function uploadFile(file: File) {
    const tokenJwt = await getIdToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    if (tokenJwt) {
        headers['Authorization'] = `Bearer ${tokenJwt}`;
    }

    // 1. Generate Upload URL
    const generateUrlRequest: GenerateUploadUrlRequest = {
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size
    };

    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    const generateResponse = await fetch(`${apiUrl}/messages/upload-url`, {
        method: 'POST',
        headers,
        body: JSON.stringify(generateUrlRequest)
    });

    if (!generateResponse.ok) {
        throw new Error('Failed to generate upload URL');
    }

    const { uploadUrl, s3Key }: GenerateUploadUrlResponse = await generateResponse.json();

    // 2. Upload to S3 (No JWT authorization header here, S3 URL is pre-signed)
    const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
    });

    if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to S3');
    }

    // 3. Register Message
    const createMessageRequest: CreateMessageRequest = {
        type: file.type.startsWith('image/') ? 'image' : 'file',
        s3Key: s3Key,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size
    };

    const registerResponse = await fetch(`${apiUrl}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(createMessageRequest)
    });

    if (!registerResponse.ok) {
        throw new Error('Failed to register message');
    }

    const data = await registerResponse.json();
    return { ...data, s3Key };
}
