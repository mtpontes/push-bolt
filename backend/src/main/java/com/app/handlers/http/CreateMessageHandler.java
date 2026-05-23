package com.app.handlers.http;

import static com.app.constants.HttpConstants.*;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import com.app.dto.CreateMessageRequest;
import com.app.dto.CreateMessageResponse;
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

import java.time.Instant;
import java.util.UUID;

@Named("create-message")
@ApplicationScoped
@RegisterForReflection
@RequiredArgsConstructor
public class CreateMessageHandler implements RequestHandler<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> {

	private final AuthService authService;
	private final ObjectMapper objectMapper;
	private final MessageRepository repository;
	private final S3Service s3Service;

	@Override
	public APIGatewayV2HTTPResponse handleRequest(APIGatewayV2HTTPEvent event, Context context) {
		try {
			String userId = this.authService.extractUserId(event);
			CreateMessageRequest input = this.objectMapper.readValue(event.getBody(), CreateMessageRequest.class);

			String s3Key = input.getS3Key();
			Long sizeBytes = null;

			if (s3Key != null && !s3Key.isBlank()) {
				try {
					sizeBytes = this.s3Service.getObjectSize(s3Key);
				} catch (software.amazon.awssdk.services.s3.model.NoSuchKeyException e) {
					Log.warnf("File with key '%s' not found in S3 bucket", s3Key);
					return APIGatewayV2HTTPResponse.builder()
							.withStatusCode(HttpStatusCode.BAD_REQUEST)
							.withHeaders(CONTENT_TYPE_APPLICATION_JSON)
							.withBody("{\"error\":\"File does not exist in storage\"}")
							.build();
				} catch (Exception e) {
					Log.error("Error checking file existence in S3", e);
					return APIGatewayV2HTTPResponse.builder()
							.withStatusCode(HttpStatusCode.BAD_REQUEST)
							.withHeaders(CONTENT_TYPE_APPLICATION_JSON)
							.withBody("{\"error\":\"Failed to verify file storage\"}")
							.build();
				}
			}

			String messageId = UUID.randomUUID().toString();
			String createdAt = Instant.now().toString();
			Message messageEntity = Message.builder()
					.userId(userId)
					.messageId(messageId)
					.createdAt(createdAt)
					.type(input.getType())
					.content(input.getContent())
					.fileName(input.getFileName())
					.mimeType(input.getMimeType())
					.sizeBytes(sizeBytes)
					.s3Key(s3Key)
					.build();

			this.repository.save(messageEntity);

			CreateMessageResponse responseBody = CreateMessageResponse.builder()
					.messageId(messageId)
					.createdAt(createdAt)
					.build();

			return APIGatewayV2HTTPResponse.builder()
					.withStatusCode(HttpStatusCode.CREATED)
					.withHeaders(CONTENT_TYPE_APPLICATION_JSON)
					.withBody(this.objectMapper.writeValueAsString(responseBody))
					.build();

		} catch (Exception e) {
			Log.error("Error creating message", e);
			return INTERNAL_SERVER_ERROR_RESPONSE;
		}
	}
}
