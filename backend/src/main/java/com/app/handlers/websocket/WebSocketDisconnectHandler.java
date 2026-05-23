package com.app.handlers.websocket;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.app.repository.ConnectionRepository;
import com.app.service.AuthService;
import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import lombok.RequiredArgsConstructor;
import software.amazon.awssdk.http.HttpStatusCode;

import io.quarkus.logging.Log;

import java.util.HashMap;
import java.util.Map;

@Named("websocket-disconnect")
@ApplicationScoped
@RegisterForReflection
@RequiredArgsConstructor
public class WebSocketDisconnectHandler implements RequestHandler<Map<String, Object>, Map<String, Object>> {

    private final ConnectionRepository repository;
    private final AuthService authService;

    @Override
    @SuppressWarnings("unchecked")
    public Map<String, Object> handleRequest(Map<String, Object> input, Context context) {
        try {
            Map<String, Object> requestContext = (Map<String, Object>) input.get("requestContext");
            if (requestContext == null) {
                return createResponse(HttpStatusCode.INTERNAL_SERVER_ERROR, "Missing requestContext");
            }

            String connectionId = (String) requestContext.get("connectionId");
            if (connectionId == null) {
                return createResponse(HttpStatusCode.INTERNAL_SERVER_ERROR, "Missing connectionId");
            }
            
            String userId = this.authService.extractUserIdFromWebSocketEvent(input);

            if (userId == null || "default-user".equals(userId)) {
                Log.warnf("Disconnect request connectionId=%s resolved to default-user or null. Cleaning connection anyway.", connectionId);
            }

            Log.infof("Removing connection connectionId=%s for userId=%s", connectionId, userId);
            this.repository.delete(userId, connectionId);

            return createResponse(HttpStatusCode.OK, "Disconnected.");
        } catch (Exception e) {
            Log.error("Error in websocket disconnect", e);
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
