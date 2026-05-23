package com.app.service;

import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent.RequestContext;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent.RequestContext.Authorizer;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent.RequestContext.Authorizer.JWT;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

@QuarkusTest
public class AuthServiceTest {

    @Inject
    AuthService authService;

    @Test
    @DisplayName("Given event is null, when extracting userId, then should return default-user")
    void testExtractUserIdEventNull() {
        // Act
        String result = this.authService.extractUserId(null);

        // Assert
        assertEquals("default-user", result);
    }

    @Test
    @DisplayName("Given event has x-user-id header, when extracting userId, then should return the header value")
    void testExtractUserIdFromHeader() {
        // Arrange
        Map<String, String> headers = new HashMap<>();
        headers.put("x-user-id", "user-from-header");
        
        APIGatewayV2HTTPEvent event = APIGatewayV2HTTPEvent.builder()
                .withHeaders(headers)
                .build();

        // Act
        String result = this.authService.extractUserId(event);

        // Assert
        assertEquals("user-from-header", result);
    }

    @Test
    @DisplayName("Given event has X-User-Id header capitalized, when extracting userId, then should return the header value")
    void testExtractUserIdFromHeaderCapitalized() {
        // Arrange
        Map<String, String> headers = new HashMap<>();
        headers.put("X-User-Id", "user-from-header-capitalized");
        
        APIGatewayV2HTTPEvent event = APIGatewayV2HTTPEvent.builder()
                .withHeaders(headers)
                .build();

        // Act
        String result = this.authService.extractUserId(event);

        // Assert
        assertEquals("user-from-header-capitalized", result);
    }

    @Test
    @DisplayName("Given event has sub claim in JWT context, when extracting userId, then should return the claim value")
    void testExtractUserIdFromJwtClaims() {
        // Arrange
        Map<String, String> claims = new HashMap<>();
        claims.put("sub", "user-from-jwt-claims");

        JWT jwt = JWT.builder()
                .withClaims(claims)
                .build();

        Authorizer authorizer = Authorizer.builder()
                .withJwt(jwt)
                .build();

        RequestContext requestContext = RequestContext.builder()
                .withAuthorizer(authorizer)
                .build();

        APIGatewayV2HTTPEvent event = APIGatewayV2HTTPEvent.builder()
                .withRequestContext(requestContext)
                .build();

        // Act
        String result = this.authService.extractUserId(event);

        // Assert
        assertEquals("user-from-jwt-claims", result);
    }

    @Test
    @DisplayName("Given event has no headers and no claims, when extracting userId, then should return default-user")
    void testExtractUserIdFallback() {
        // Arrange
        APIGatewayV2HTTPEvent event = APIGatewayV2HTTPEvent.builder()
                .build();

        // Act
        String result = this.authService.extractUserId(event);

        // Assert
        assertEquals("default-user", result);
    }
}
