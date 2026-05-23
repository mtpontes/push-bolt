package com.app.service;

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.enterprise.context.ApplicationScoped;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.apigatewaymanagementapi.ApiGatewayManagementApiClient;
import software.amazon.awssdk.services.apigatewaymanagementapi.model.PostToConnectionRequest;

import java.net.URI;
import java.util.Optional;

@ApplicationScoped
@RegisterForReflection
public class ApiGatewayService {

    private ApiGatewayManagementApiClient client;

    public ApiGatewayService() {
        this.client = Optional.ofNullable(System.getenv("WEBSOCKET_API_ENDPOINT"))
                .filter(endpoint -> !endpoint.isBlank())
                .map(endpoint -> ApiGatewayManagementApiClient.builder()
                        .endpointOverride(URI.create(endpoint))
                        .build())
                .orElse(null);
    }

    public void sendToConnection(String connectionId, String data) {
        if (this.client == null) {
            throw new IllegalStateException("WEBSOCKET_API_ENDPOINT environment variable is missing or blank. WebSocket client is not initialized.");
        }
        PostToConnectionRequest request = PostToConnectionRequest.builder()
                .connectionId(connectionId)
                .data(SdkBytes.fromUtf8String(data))
                .build();
        this.client.postToConnection(request);
    }
}
