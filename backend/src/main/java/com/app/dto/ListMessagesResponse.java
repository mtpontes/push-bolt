package com.app.dto;

import io.quarkus.runtime.annotations.RegisterForReflection;
import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
@RegisterForReflection
public class ListMessagesResponse {
    private List<MessageItem> items;
    private String nextToken;

    @Data
    @Builder
    @RegisterForReflection
    public static class MessageItem {
        private String messageId;
        private String userId;
        private String createdAt;
        private String type;
        private String content;
        private String fileName;
        private Long sizeBytes;
        private String downloadUrl;
    }
}
