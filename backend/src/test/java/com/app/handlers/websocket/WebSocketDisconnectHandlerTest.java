package com.app.handlers.websocket;

import com.app.repository.ConnectionRepository;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;

@QuarkusTest
public class WebSocketDisconnectHandlerTest {

    @Inject
    WebSocketDisconnectHandler handler;

    @InjectMock
    ConnectionRepository repository;

    @Test
    @DisplayName("Given a valid disconnect request, when handled, then should delete the connection in repository and return 200 status")
    void testDisconnect() {
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
        verify(this.repository).delete("user-456", "conn-123");
    }
}
