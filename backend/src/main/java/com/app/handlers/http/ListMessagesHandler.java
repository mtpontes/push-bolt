package com.app.handlers.http;

import static com.app.constants.HttpConstants.*;

import java.util.Optional;
import java.util.stream.Collectors;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import com.app.dto.ListMessagesResponse;
import com.app.model.Message;
import com.app.model.PagedResult;
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

@Named("list-messages")
@ApplicationScoped
@RegisterForReflection
@RequiredArgsConstructor
public class ListMessagesHandler implements RequestHandler<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> {

	private final AuthService authService;
	private final ObjectMapper objectMapper;
	private final S3Service s3Service;
	private final MessageRepository repository;

	@Override
	public APIGatewayV2HTTPResponse handleRequest(APIGatewayV2HTTPEvent event, Context context) {
		try {
			String userId = this.authService.extractUserId(event);

			String nextToken = Optional.ofNullable(event.getQueryStringParameters())
					.map(params -> params.get("nextToken"))
					.orElse(null);

			PagedResult<Message> result = this.repository.findByUserId(userId, nextToken);

			ListMessagesResponse responseBody = ListMessagesResponse.builder()
					.items(result.getItems().stream()
							.map(msg -> {
								String downloadUrl = null;
								if ("file".equals(msg.getType())
										|| "image".equals(msg.getType()))
									downloadUrl = this.s3Service
											.generatePresignedGetUrl(
													msg.getS3Key());

								return ListMessagesResponse.MessageItem.builder()
										.messageId(msg.getMessageId())
										.userId(msg.getUserId())
										.createdAt(msg.getCreatedAt())
										.type(msg.getType())
										.content(msg.getContent())
										.fileName(msg.getFileName())
										.sizeBytes(msg.getSizeBytes())
										.downloadUrl(downloadUrl)
										.build();
							})
							.collect(Collectors.toList()))
					.nextToken(result.getNextToken())
					.build();

			return APIGatewayV2HTTPResponse.builder()
					.withStatusCode(HttpStatusCode.OK)
					.withHeaders(CONTENT_TYPE_APPLICATION_JSON)
					.withBody(this.objectMapper.writeValueAsString(responseBody))
					.build();

		} catch (Exception e) {
			Log.error("Error listing messages", e);
			return INTERNAL_SERVER_ERROR_RESPONSE;
		}
	}
}
