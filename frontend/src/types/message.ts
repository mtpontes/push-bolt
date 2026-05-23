export interface MessageItem {
    messageId: string;
    userId: string;
    createdAt: string;
    type: 'text' | 'link' | 'image' | 'file';
    content?: string;
    fileName?: string;
    sizeBytes?: number;
    downloadUrl?: string;
}

export interface ListMessagesResponse {
    items: MessageItem[];
    nextToken?: string;
}

export interface CreateMessageRequest {
    type: 'text' | 'link' | 'image' | 'file';
    content?: string;
    s3Key?: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
}

export interface CreateMessageResponse {
    messageId: string;
    createdAt: string;
}

export interface GenerateUploadUrlRequest {
    fileName: string;
    mimeType: string;
    sizeBytes?: number;
    userId?: string;
}

export interface GenerateUploadUrlResponse {
    uploadUrl: string;
    s3Key: string;
}
