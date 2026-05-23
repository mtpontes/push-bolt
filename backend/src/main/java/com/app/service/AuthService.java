package com.app.service;

import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import io.quarkus.runtime.LaunchMode;
import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.enterprise.context.ApplicationScoped;
import lombok.RequiredArgsConstructor;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.Map;
import java.util.Optional;

@ApplicationScoped
@RequiredArgsConstructor
@RegisterForReflection
public class AuthService {

    private static final String DEFAULT_USER = "default-user";
    private static final String SUBJECT = "sub";

    @ConfigProperty(name = "STAGE", defaultValue = "prod")
    String stage;

    public String extractUserId(APIGatewayV2HTTPEvent event) {
        if (event == null)
            return AuthService.DEFAULT_USER;

        // 1. Tentar extrair do header x-user-id ou X-User-Id apenas em ambiente de desenvolvimento ou testes
        if (this.isLocalOrTestEnvironment()) {
            if (event.getHeaders() != null) {
                String uid = event.getHeaders().get("x-user-id");
                if (uid == null)
                    uid = event.getHeaders().get("X-User-Id");
                if (uid != null && !uid.isBlank())
                    return uid;
            }
        }

        // 2. Tentar extrair de requestContext.authorizer.jwt.claims.sub
        if (event.getRequestContext() != null &&
            event.getRequestContext().getAuthorizer() != null &&
            event.getRequestContext().getAuthorizer().getJwt() != null &&
            event.getRequestContext().getAuthorizer().getJwt().getClaims() != null) {
            
            String sub = event.getRequestContext().getAuthorizer().getJwt().getClaims().get(AuthService.SUBJECT);
            if (sub != null && !sub.isBlank())
                return sub;
        }

        return AuthService.DEFAULT_USER;
    }

    @SuppressWarnings("unchecked")
    public String extractUserIdFromWebSocketEvent(Map<String, Object> event) {
        if (event == null)
            return AuthService.DEFAULT_USER;

        Map<String, Object> requestContext = (Map<String, Object>) event.get("requestContext");
        if (requestContext == null)
            return AuthService.DEFAULT_USER;

        Map<String, Object> authorizer = (Map<String, Object>) requestContext.get("authorizer");
        if (authorizer == null)
            return AuthService.DEFAULT_USER;

        String userId = (String) authorizer.get(AuthService.SUBJECT);
        if (userId != null && !userId.isBlank())
            return userId;

        Map<String, Object> claims = (Map<String, Object>) authorizer.get("claims");
        if (claims != null) {
            userId = (String) claims.get(AuthService.SUBJECT);
            if (userId != null && !userId.isBlank())
                return userId;
        }

        return AuthService.DEFAULT_USER;
    }
    private boolean isLocalOrTestEnvironment() {
        LaunchMode mode = LaunchMode.current();
        if (mode == LaunchMode.TEST || mode == LaunchMode.DEVELOPMENT)
            return true;

        return "dev".equalsIgnoreCase(this.stage) || "test".equalsIgnoreCase(this.stage) || "local".equalsIgnoreCase(this.stage);
    }
}
