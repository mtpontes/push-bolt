package com.app.handlers.http;

import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import com.app.dto.ListMessagesResponse;
import com.app.model.Message;
import com.app.model.PagedResult;
import com.app.repository.MessageRepository;
import com.app.service.S3Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@QuarkusTest
public class ListMessagesHandlerTest {

    @Inject
    ListMessagesHandler handler;

    @InjectMock
    MessageRepository repository;

    @InjectMock
    S3Service s3Service;

    @Inject
    ObjectMapper objectMapper;

    private APIGatewayV2HTTPEvent createEvent(String userId, Map<String, String> queryParams) {
        Map<String, String> headers = new HashMap<>();
        headers.put("x-user-id", userId);

        return APIGatewayV2HTTPEvent.builder()
                .withQueryStringParameters(queryParams)
                .withHeaders(headers)
                .build();
    }

    @Test
    @DisplayName("Given messages in database, when listed, then should return items with signed URLs for files and 200 status code")
    void testListMessages() throws Exception {
        // Arrange
        String userId = "user-123";
        Message textMsg = Message.builder()
                .userId(userId)
                .messageId("msg-1")
                .type("text")
                .content("Hello")
                .createdAt("2023-01-01T10:00:00Z")
                .build();

        Message fileMsg = Message.builder()
                .userId(userId)
                .messageId("msg-2")
                .type("file")
                .fileName("test.pdf")
                .s3Key("user-123/msg-2_test.pdf")
                .createdAt("2023-01-01T10:05:00Z")
                .build();

        when(this.repository.findByUserId(userId, null)).thenReturn(PagedResult.<Message>builder()
                .items(List.of(fileMsg, textMsg))
                .build());
        when(this.s3Service.generatePresignedGetUrl("user-123/msg-2_test.pdf")).thenReturn("https://signed-url.com");

        Map<String, String> queryParams = new HashMap<>();

        APIGatewayV2HTTPEvent event = this.createEvent(userId, queryParams);

        // Act
        APIGatewayV2HTTPResponse response = this.handler.handleRequest(event, null);

        // Assert
        assertNotNull(response);
        assertEquals(200, response.getStatusCode());

        ListMessagesResponse responseBody = this.objectMapper.readValue(response.getBody(), ListMessagesResponse.class);
        assertEquals(2, responseBody.getItems().size());

        // Check first item (file)
        ListMessagesResponse.MessageItem item1 = responseBody.getItems().get(0);
        assertEquals("msg-2", item1.getMessageId());
        assertEquals("https://signed-url.com", item1.getDownloadUrl());

        // Check second item (text)
        ListMessagesResponse.MessageItem item2 = responseBody.getItems().get(1);
        assertEquals("msg-1", item2.getMessageId());
        assertNull(item2.getDownloadUrl());
    }
}
