package com.app.handlers.http;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import com.app.dto.DeleteMessageResponse;
import com.app.model.Message;
import com.app.repository.MessageRepository;
import com.app.service.AuthService;
import com.app.service.S3Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.logging.Log;
import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import lombok.RequiredArgsConstructor;
import software.amazon.awssdk.http.HttpStatusCode;

import static com.app.constants.HttpConstants.*;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

@Named("delete-message")
@ApplicationScoped
@RegisterForReflection
@RequiredArgsConstructor
public class DeleteMessageHandler implements RequestHandler<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> {

    private final AuthService authService;
    private final ObjectMapper objectMapper;
    private final S3Service s3Service;
    private final MessageRepository messageRepository;

    @Override
    public APIGatewayV2HTTPResponse handleRequest(APIGatewayV2HTTPEvent event, Context context) {
        try {
            String userId = this.authService.extractUserId(event);

			String createdAt = Optional.ofNullable(event)
                    .map(APIGatewayV2HTTPEvent::getPathParameters)
                    .map(params -> params.get("createdAt"))
                    .filter(createdAtParam -> !createdAtParam.isBlank())
                    .map(decoded -> URLDecoder.decode(decoded, StandardCharsets.UTF_8))
                    .orElse(null);

            if (createdAt == null) {
                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(HttpStatusCode.BAD_REQUEST)
                        .withHeaders(CONTENT_TYPE_APPLICATION_JSON)
                        .withBody("{\"error\":\"Missing path parameter: createdAt\"}")
                        .build();
            }

            Message message = this.messageRepository.findById(userId, createdAt);
            if (message == null) {
				Log.warnf("Message created at '%s' not found for user '%s'", createdAt, userId);
                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(HttpStatusCode.NOT_FOUND)
                        .withHeaders(CONTENT_TYPE_APPLICATION_JSON)
                        .withBody("{\"error\":\"Message not found\"}")
                        .build();
            }

            if (message.getS3Key() != null && !message.getS3Key().isEmpty())
                this.s3Service.deleteObject(message.getS3Key());

            this.messageRepository.delete(userId, createdAt);

            DeleteMessageResponse responseBody = DeleteMessageResponse.builder()
                    .success(true)
                    .message("Message deleted successfully")
                    .build();

            return APIGatewayV2HTTPResponse.builder()
                    .withStatusCode(HttpStatusCode.OK)
                    .withHeaders(CONTENT_TYPE_APPLICATION_JSON)
                    .withBody(this.objectMapper.writeValueAsString(responseBody))
                    .build();

		} catch (Exception e) {
			Log.error("Error deleting message", e);
			return INTERNAL_SERVER_ERROR_RESPONSE;
		}
    }
}
