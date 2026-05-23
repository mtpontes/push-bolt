import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { uploadFile } from './uploadService';

const server = setupServer(
    // 1. Mock Generate Upload URL
    http.post('*/messages/upload-url', async ({ request }) => {
        const body: any = await request.json();
        if (!body.fileName) return new HttpResponse(null, { status: 400 });
        
        return HttpResponse.json({
            uploadUrl: 'https://s3.mock/upload-here',
            s3Key: 'user-1/test-file.txt'
        });
    }),

    // 2. Mock S3 PUT
    http.put('https://s3.mock/upload-here', () => {
        return new HttpResponse(null, { status: 200 });
    }),

    // 3. Mock Create Message
    http.post('*/messages', async ({ request }) => {
        const body: any = await request.json();
        return HttpResponse.json({
            messageId: 'msg-123',
            createdAt: new Date().toISOString(),
            ...body
        });
    })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('uploadService', () => {
    it('should perform the complete upload flow', async () => {
        const file = new File(['hello world'], 'test.txt', { type: 'text/plain' });
        
        const result = await uploadFile(file);

        expect(result.messageId).toBe('msg-123');
        expect(result.s3Key).toBe('user-1/test-file.txt');
    });

    it('should throw error if upload url generation fails', async () => {
        server.use(
            http.post('*/messages/upload-url', () => {
                return new HttpResponse(null, { status: 500 });
            })
        );

        const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
        await expect(uploadFile(file)).rejects.toThrow('Failed to generate upload URL');
    });
});
