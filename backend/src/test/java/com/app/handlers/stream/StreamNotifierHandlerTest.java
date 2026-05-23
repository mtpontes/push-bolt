package com.app.handlers.stream;

import com.app.model.Connection;
import com.app.repository.ConnectionRepository;
import com.app.service.ApiGatewayService;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@QuarkusTest
public class StreamNotifierHandlerTest {

    @Inject
    StreamNotifierHandler handler;

    @InjectMock
    ConnectionRepository connectionRepository;

    @InjectMock
    ApiGatewayService apiGatewayService;

    @Test
    @DisplayName("Given a new message in stream, when handled, then should push to all user connections")
    void testNotifyConnections() {
        // Arrange
        String userId = "user-123";
        
        Map<String, Object> newImage = Map.of(
            "userId", Map.of("S", userId),
            "messageId", Map.of("S", "msg-001"),
            "content", Map.of("S", "Hello Stream")
        );
        
        Map<String, Object> dynamodb = Map.of("NewImage", newImage);
        Map<String, Object> record = Map.of(
            "eventName", "INSERT",
            "dynamodb", dynamodb
        );
        Map<String, Object> event = Map.of("Records", List.of(record));

        Connection conn1 = Connection.builder().userId(userId).connectionId("conn-1").build();
        Connection conn2 = Connection.builder().userId(userId).connectionId("conn-2").build();
        when(this.connectionRepository.findByUserId(userId)).thenReturn(List.of(conn1, conn2));

        // Act
        this.handler.handleRequest(event, null);

        // Assert
        verify(this.apiGatewayService, times(1)).sendToConnection(eq("conn-1"), anyString());
        verify(this.apiGatewayService, times(1)).sendToConnection(eq("conn-2"), anyString());
    }

    @Test
    @DisplayName("Given a connection returns 410 Gone, when handled, then should delete the connection")
    void testDeleteGoneConnection() {
        // Arrange
        String userId = "user-123";
        
        Map<String, Object> newImage = Map.of("userId", Map.of("S", userId));
        Map<String, Object> dynamodb = Map.of("NewImage", newImage);
        Map<String, Object> record = Map.of(
            "eventName", "INSERT",
            "dynamodb", dynamodb
        );
        Map<String, Object> event = Map.of("Records", List.of(record));

        Connection conn1 = Connection.builder().userId(userId).connectionId("conn-gone").build();
        when(this.connectionRepository.findByUserId(userId)).thenReturn(List.of(conn1));

        doThrow(new RuntimeException("Gone")).when(this.apiGatewayService).sendToConnection(eq("conn-gone"), anyString());

        // Act
        this.handler.handleRequest(event, null);

        // Assert
        verify(this.connectionRepository).delete(userId, "conn-gone");
    }
}
