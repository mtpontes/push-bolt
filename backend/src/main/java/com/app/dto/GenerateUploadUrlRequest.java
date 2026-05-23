package com.app.dto;

import io.quarkus.runtime.annotations.RegisterForReflection;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@RegisterForReflection
public class GenerateUploadUrlRequest {
    private String userId;
    private String fileName;
    private String mimeType;
    private Long sizeBytes;
}
