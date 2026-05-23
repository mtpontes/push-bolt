package com.app.handlers.http;

import static com.app.constants.HttpConstants.*;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import com.app.dto.GenerateUploadUrlRequest;
import com.app.dto.GenerateUploadUrlResponse;
import com.app.service.AuthService;
import com.app.service.S3Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.logging.Log;
import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import lombok.RequiredArgsConstructor;
import software.amazon.awssdk.http.HttpStatusCode;

import java.util.UUID;

@Named("generate-upload-url")
@ApplicationScoped
@RegisterForReflection
@RequiredArgsConstructor
public class GenerateUploadUrlHandler implements RequestHandler<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> {

	private static final long MAX_FILE_SIZE_BYTES = 25L * 1024L * 1024L;

	private final AuthService authService;
	private final ObjectMapper objectMapper;
	private final S3Service s3Service;

	@Override
	public APIGatewayV2HTTPResponse handleRequest(APIGatewayV2HTTPEvent event, Context context) {
		try {
			String userId = this.authService.extractUserId(event);

			GenerateUploadUrlRequest input = this.objectMapper.readValue(
					event.getBody(),
					GenerateUploadUrlRequest.class);

			if (input.getSizeBytes() != null && input.getSizeBytes() > MAX_FILE_SIZE_BYTES) {
				return APIGatewayV2HTTPResponse.builder()
						.withStatusCode(HttpStatusCode.BAD_REQUEST)
						.withHeaders(CONTENT_TYPE_APPLICATION_JSON)
						.withBody("{\"error\":\"File size exceeds 25MB limit\"}")
						.build();
			}

			String s3Key = String.format("%s/%s_%s", userId, UUID.randomUUID().toString(), input.getFileName());
			String uploadUrl = this.s3Service.generatePutPresignedUrl(s3Key, input.getMimeType());

			GenerateUploadUrlResponse responseBody = GenerateUploadUrlResponse.builder()
					.uploadUrl(uploadUrl)
					.s3Key(s3Key)
					.build();

			return APIGatewayV2HTTPResponse.builder()
					.withStatusCode(HttpStatusCode.OK)
					.withHeaders(CONTENT_TYPE_APPLICATION_JSON)
					.withBody(this.objectMapper.writeValueAsString(responseBody))
					.build();

		} catch (Exception e) {
			Log.error("Error generating upload URL", e);
			return INTERNAL_SERVER_ERROR_RESPONSE;
		}
	}
}
