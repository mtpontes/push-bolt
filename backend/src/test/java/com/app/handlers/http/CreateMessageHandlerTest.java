package com.app.handlers.http;

import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import com.app.dto.CreateMessageResponse;
import com.app.repository.MessageRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.verify;

@QuarkusTest
public class CreateMessageHandlerTest {

    @Inject
    CreateMessageHandler handler;

    @InjectMock
    MessageRepository repository;

    @InjectMock
    com.app.service.S3Service s3Service;

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
    @DisplayName("Given a valid text message request, when handled, then should save message in DynamoDB and return 201 status code")
    void testCreateMessageSuccess() throws Exception {
        // Arrange
        String requestBody = "{\"type\":\"text\",\"content\":\"Hello Test\"}";
        APIGatewayV2HTTPEvent event = this.createEvent(requestBody, "user-123");

        // Act
        APIGatewayV2HTTPResponse response = this.handler.handleRequest(event, null);

        // Assert
        assertNotNull(response);
        assertEquals(201, response.getStatusCode());
        assertEquals("application/json", response.getHeaders().get("Content-Type"));

        CreateMessageResponse responseBody = this.objectMapper.readValue(response.getBody(), CreateMessageResponse.class);
        assertNotNull(responseBody.getMessageId());
        assertNotNull(responseBody.getCreatedAt());

        ArgumentCaptor<com.app.model.Message> messageCaptor = ArgumentCaptor.forClass(com.app.model.Message.class);
        verify(this.repository).save(messageCaptor.capture());

        com.app.model.Message savedMessage = messageCaptor.getValue();
        assertEquals("user-123", savedMessage.getUserId());
        assertEquals("text", savedMessage.getType());
        assertEquals("Hello Test", savedMessage.getContent());
    }

    @Test
    @DisplayName("Given a request with x-user-id header, when handled, then should use the header value as userId")
    void testCreateMessageWithXUserIdHeader() throws Exception {
        // Arrange
        String requestBody = "{\"type\":\"text\",\"content\":\"Authorized Msg\"}";
        
        Map<String, String> headers = new HashMap<>();
        headers.put("x-user-id", "cognito-user-999");
        
        APIGatewayV2HTTPEvent event = APIGatewayV2HTTPEvent.builder()
                .withBody(requestBody)
                .withHeaders(headers)
                .build();

        // Act
        APIGatewayV2HTTPResponse response = this.handler.handleRequest(event, null);

        // Assert
        assertEquals(201, response.getStatusCode());

        ArgumentCaptor<com.app.model.Message> messageCaptor = ArgumentCaptor.forClass(com.app.model.Message.class);
        verify(this.repository).save(messageCaptor.capture());
        
        com.app.model.Message savedMessage = messageCaptor.getValue();
        assertEquals("cognito-user-999", savedMessage.getUserId());
    }

    @Test
    @DisplayName("Given a file message request, when handled and file exists, then should fetch size from S3, save and return 201")
    void testCreateMessageWithFileSuccess() throws Exception {
        // Arrange
        String requestBody = "{\"type\":\"file\",\"s3Key\":\"user-123/file-1.pdf\",\"fileName\":\"file-1.pdf\",\"mimeType\":\"application/pdf\",\"sizeBytes\":1000}";
        APIGatewayV2HTTPEvent event = this.createEvent(requestBody, "user-123");

        org.mockito.Mockito.when(this.s3Service.getObjectSize("user-123/file-1.pdf")).thenReturn(54321L);

        // Act
        APIGatewayV2HTTPResponse response = this.handler.handleRequest(event, null);

        // Assert
        assertNotNull(response);
        assertEquals(201, response.getStatusCode());

        ArgumentCaptor<com.app.model.Message> messageCaptor = ArgumentCaptor.forClass(com.app.model.Message.class);
        verify(this.repository).save(messageCaptor.capture());

        com.app.model.Message savedMessage = messageCaptor.getValue();
        assertEquals("user-123", savedMessage.getUserId());
        assertEquals("file", savedMessage.getType());
        assertEquals("user-123/file-1.pdf", savedMessage.getS3Key());
        assertEquals("file-1.pdf", savedMessage.getFileName());
        assertEquals("application/pdf", savedMessage.getMimeType());
        // Deve usar o tamanho do S3 (54321) e ignorar o do request (1000)
        assertEquals(54321L, savedMessage.getSizeBytes());
    }

    @Test
    @DisplayName("Given a file message request, when file does not exist in S3, then should return 400 Bad Request")
    void testCreateMessageFileNotExist() throws Exception {
        // Arrange
        String requestBody = "{\"type\":\"file\",\"s3Key\":\"user-123/nonexistent.pdf\",\"fileName\":\"nonexistent.pdf\",\"mimeType\":\"application/pdf\"}";
        APIGatewayV2HTTPEvent event = this.createEvent(requestBody, "user-123");

        org.mockito.Mockito.when(this.s3Service.getObjectSize("user-123/nonexistent.pdf"))
                .thenThrow(software.amazon.awssdk.services.s3.model.NoSuchKeyException.builder().message("NoSuchKey").build());

        // Act
        APIGatewayV2HTTPResponse response = this.handler.handleRequest(event, null);

        // Assert
        assertNotNull(response);
        assertEquals(400, response.getStatusCode());
        assertTrue(response.getBody().contains("File does not exist in storage"));
    }
}
