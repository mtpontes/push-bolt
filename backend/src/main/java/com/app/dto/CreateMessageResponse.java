package com.app.dto;

import io.quarkus.runtime.annotations.RegisterForReflection;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@RegisterForReflection
public class CreateMessageResponse {
    private String messageId;
    private String createdAt;
}
