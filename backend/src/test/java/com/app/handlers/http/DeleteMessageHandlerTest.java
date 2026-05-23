package com.app.handlers.http;

import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import com.app.dto.DeleteMessageResponse;
import com.app.model.Message;
import com.app.repository.MessageRepository;
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
import static org.mockito.Mockito.*;

@QuarkusTest
public class DeleteMessageHandlerTest {

    @Inject
    DeleteMessageHandler handler;

    @InjectMock
    MessageRepository repository;

    @InjectMock
    S3Service s3Service;

    @Inject
    ObjectMapper objectMapper;

    private APIGatewayV2HTTPEvent createEvent(String userId, Map<String, String> pathParams) {
        Map<String, String> headers = new HashMap<>();
        headers.put("x-user-id", userId);

        return APIGatewayV2HTTPEvent.builder()
                .withPathParameters(pathParams)
                .withHeaders(headers)
                .build();
    }

    @Test
    @DisplayName("Given a text message, when deleted, then should succeed and not delete from S3")
    void testDeleteTextMessageSuccess() throws Exception {
        // Arrange
        String userId = "user-123";
        String createdAt = "2023-01-01T10:00:00.000Z";

        Message textMsg = Message.builder()
                .userId(userId)
                .messageId("msg-1")
                .type("text")
                .content("Hello World")
                .createdAt(createdAt)
                .build();

        when(this.repository.findById(userId, createdAt)).thenReturn(textMsg);

        Map<String, String> pathParams = new HashMap<>();
        pathParams.put("createdAt", createdAt);

        APIGatewayV2HTTPEvent event = this.createEvent(userId, pathParams);

        // Act
        APIGatewayV2HTTPResponse response = this.handler.handleRequest(event, null);

        // Assert
        assertNotNull(response);
        assertEquals(200, response.getStatusCode());

        DeleteMessageResponse responseBody = this.objectMapper.readValue(response.getBody(), DeleteMessageResponse.class);
        assertTrue(responseBody.isSuccess());
        assertEquals("Message deleted successfully", responseBody.getMessage());

        verify(this.repository, times(1)).delete(userId, createdAt);
        verify(this.s3Service, never()).deleteObject(anyString());
    }

    @Test
    @DisplayName("Given a file message, when deleted, then should delete from S3 and database")
    void testDeleteFileMessageSuccess() throws Exception {
        // Arrange
        String userId = "user-123";
        String createdAt = "2023-01-01T10:00:00.000Z";
        String s3Key = "user-123/file-1_document.pdf";

        Message fileMsg = Message.builder()
                .userId(userId)
                .messageId("msg-2")
                .type("file")
                .fileName("document.pdf")
                .s3Key(s3Key)
                .createdAt(createdAt)
                .build();

        when(this.repository.findById(userId, createdAt)).thenReturn(fileMsg);

        Map<String, String> pathParams = new HashMap<>();
        pathParams.put("createdAt", createdAt);

        APIGatewayV2HTTPEvent event = this.createEvent(userId, pathParams);

        // Act
        APIGatewayV2HTTPResponse response = this.handler.handleRequest(event, null);

        // Assert
        assertNotNull(response);
        assertEquals(200, response.getStatusCode());

        DeleteMessageResponse responseBody = this.objectMapper.readValue(response.getBody(), DeleteMessageResponse.class);
        assertTrue(responseBody.isSuccess());

        verify(this.s3Service, times(1)).deleteObject(s3Key);
        verify(this.repository, times(1)).delete(userId, createdAt);
    }

    @Test
    @DisplayName("Given an empty or non-existent message, when deleted, then should return 404 not found")
    void testDeleteMessageNotFound() throws Exception {
        // Arrange
        String userId = "user-123";
        String createdAt = "2023-01-01T10:00:00.000Z";

        when(this.repository.findById(userId, createdAt)).thenReturn(null);

        Map<String, String> pathParams = new HashMap<>();
        pathParams.put("createdAt", createdAt);

        APIGatewayV2HTTPEvent event = this.createEvent(userId, pathParams);

        // Act
        APIGatewayV2HTTPResponse response = this.handler.handleRequest(event, null);

        // Assert
        assertNotNull(response);
        assertEquals(404, response.getStatusCode());
        assertTrue(response.getBody().contains("Message not found"));

        verify(this.repository, never()).delete(anyString(), anyString());
        verify(this.s3Service, never()).deleteObject(anyString());
    }
}
