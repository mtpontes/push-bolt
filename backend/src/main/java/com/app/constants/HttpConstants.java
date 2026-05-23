package com.app.constants;

import java.util.Map;

import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;

import io.quarkus.runtime.annotations.RegisterForReflection;
import software.amazon.awssdk.http.HttpStatusCode;

@RegisterForReflection
public final class HttpConstants {

    private HttpConstants() {
    }

    public static final Map<String, String> CONTENT_TYPE_APPLICATION_JSON = Map.of("Content-Type", "application/json");
    public static final APIGatewayV2HTTPResponse INTERNAL_SERVER_ERROR_RESPONSE = APIGatewayV2HTTPResponse.builder()
            .withStatusCode(HttpStatusCode.INTERNAL_SERVER_ERROR)
            .withHeaders(CONTENT_TYPE_APPLICATION_JSON)
            .withBody("{\"error\":\"Internal Server Error\"}")
            .build();
}
