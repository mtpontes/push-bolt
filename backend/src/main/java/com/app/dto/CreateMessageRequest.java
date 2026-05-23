package com.app.dto;

import io.quarkus.runtime.annotations.RegisterForReflection;
import lombok.Data;

@Data
@RegisterForReflection
public class CreateMessageRequest {
    private String type;
    private String content;
    private String fileName;
    private String mimeType;
    private Long sizeBytes;
    private String s3Key;
}
