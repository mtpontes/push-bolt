package com.app.handlers.websocket;

import com.app.repository.ConnectionRepository;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.verify;

@QuarkusTest
public class WebSocketConnectHandlerTest {

    @Inject
    WebSocketConnectHandler handler;

    @InjectMock
    ConnectionRepository repository;

    @Test
    @DisplayName("Given a valid connection request, when handled, then should save connection with TTL and return 200 status")
    void testConnect() {
        // Arrange
        Map<String, Object> input = new HashMap<>();
        Map<String, Object> requestContext = new HashMap<>();
        requestContext.put("connectionId", "conn-123");

        Map<String, Object> authorizer = new HashMap<>();
        authorizer.put("sub", "user-456");
        requestContext.put("authorizer", authorizer);

        input.put("requestContext", requestContext);

        // Act
        Map<String, Object> response = this.handler.handleRequest(input, null);

        // Assert
        assertEquals(200, response.get("statusCode"));

        ArgumentCaptor<com.app.model.Connection> connectionCaptor = ArgumentCaptor.forClass(com.app.model.Connection.class);
        verify(this.repository).save(connectionCaptor.capture());

        com.app.model.Connection savedConnection = connectionCaptor.getValue();
        assertEquals("user-456", savedConnection.getUserId());
        assertEquals("conn-123", savedConnection.getConnectionId());
        assertNotNull(savedConnection.getConnectedAt());
        assertNotNull(savedConnection.getTtl());
    }
}
