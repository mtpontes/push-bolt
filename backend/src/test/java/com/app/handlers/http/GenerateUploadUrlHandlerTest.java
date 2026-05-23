package com.app.handlers.http;

import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import com.app.dto.GenerateUploadUrlResponse;
import com.app.service.S3Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@QuarkusTest
public class GenerateUploadUrlHandlerTest {

    @Inject
    GenerateUploadUrlHandler handler;

    @InjectMock
    S3Service s3Service;

    @Inject
    ObjectMapper objectMapper;

    private APIGatewayV2HTTPEvent createEvent(String body, String userId) {
        Map<String, String> headers = new HashMap<>();
        headers.put("x-user-id", userId);

        return APIGatewayV2HTTPEvent.builder()
                .withBody(body)
                .withHeaders(headers)
                .build();
    }

    @Test
    @DisplayName("Given a valid upload request, when handled, then should return pre-signed PUT URL and s3Key with 200 status")
    void testGenerateUploadUrl() throws Exception {
        // Arrange
        String requestBody = "{\"fileName\":\"test.jpg\",\"mimeType\":\"image/jpeg\",\"sizeBytes\":1024}";
        String fakeUrl = "https://s3.amazonaws.com/bucket/user-123/uuid_test.jpg?signature=...";

        when(this.s3Service.generatePutPresignedUrl(anyString(), eq("image/jpeg"))).thenReturn(fakeUrl);

        APIGatewayV2HTTPEvent event = this.createEvent(requestBody, "user-123");

        // Act
        APIGatewayV2HTTPResponse response = this.handler.handleRequest(event, null);

        // Assert
        assertNotNull(response);
        assertEquals(200, response.getStatusCode());

        GenerateUploadUrlResponse responseBody = this.objectMapper.readValue(response.getBody(), GenerateUploadUrlResponse.class);
        assertEquals(fakeUrl, responseBody.getUploadUrl());
        assertNotNull(responseBody.getS3Key());
        assertTrue(responseBody.getS3Key().startsWith("user-123/"));
    }

    @Test
    @DisplayName("Given a file larger than 25MB, when handled, then should return 400 Bad Request")
    void testFileSizeLimit() throws Exception {
        // Arrange
        long size30MB = 30 * 1024 * 1024L;
        String requestBody = String.format("{\"userId\":\"user-123\",\"fileName\":\"large.zip\",\"mimeType\":\"application/zip\",\"sizeBytes\":%d}", size30MB);

        APIGatewayV2HTTPEvent event = APIGatewayV2HTTPEvent.builder()
                .withBody(requestBody)
                .build();

        // Act
        APIGatewayV2HTTPResponse response = this.handler.handleRequest(event, null);

        // Assert
        assertNotNull(response);
        assertEquals(400, response.getStatusCode());
        assertTrue(response.getBody().contains("exceeds 25MB limit"));
    }
}
