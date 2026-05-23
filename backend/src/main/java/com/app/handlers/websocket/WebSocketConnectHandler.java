package com.app.handlers.websocket;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.app.model.Connection;
import com.app.repository.ConnectionRepository;
import com.app.service.AuthService;

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import lombok.RequiredArgsConstructor;
import software.amazon.awssdk.http.HttpStatusCode;

import io.quarkus.logging.Log;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;

@Named("websocket-connect")
@ApplicationScoped
@RegisterForReflection
@RequiredArgsConstructor
public class WebSocketConnectHandler implements RequestHandler<Map<String, Object>, Map<String, Object>> {

    private final AuthService authService;
    private final ConnectionRepository connectionRepository;

    @Override
    @SuppressWarnings("unchecked")
    public Map<String, Object> handleRequest(Map<String, Object> input, Context context) {
        try {
            Log.info("Processing $connect WebSocket event");

            String userId = this.authService.extractUserIdFromWebSocketEvent(input);

            Map<String, Object> requestContext = (Map<String, Object>) input.get("requestContext");
            if (requestContext == null) {
                Log.error("requestContext is null");
                return createResponse(HttpStatusCode.INTERNAL_SERVER_ERROR, "Missing requestContext");
            }
            
            String connectionId = (String) requestContext.get("connectionId");
            if (connectionId == null) {
                Log.error("connectionId is null");
                return createResponse(HttpStatusCode.INTERNAL_SERVER_ERROR, "Missing connectionId");
            }

            Instant now = Instant.now();
            long ttl = now.plus(24, ChronoUnit.HOURS).getEpochSecond();

            Connection connectionEntity = Connection.builder()
                    .userId(userId)
                    .connectionId(connectionId)
                    .connectedAt(now.toString())
                    .ttl(ttl)
                    .build();

            Log.infof("Saving connection: %s for user: %s", connectionId, userId);
            this.connectionRepository.save(connectionEntity);

            return createResponse(HttpStatusCode.OK, "Connected.");
        } catch (Exception e) {
            Log.error("Error in websocket connect: " + e.getMessage(), e);
            return createResponse(HttpStatusCode.INTERNAL_SERVER_ERROR, "Internal Server Error");
        }
    }

    private Map<String, Object> createResponse(int statusCode, String body) {
        Map<String, Object> response = new HashMap<>();
        response.put("statusCode", statusCode);
        response.put("body", body);
        return response;
    }
}
