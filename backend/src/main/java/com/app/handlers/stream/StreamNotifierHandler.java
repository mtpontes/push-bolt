package com.app.handlers.stream;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.app.dto.ListMessagesResponse;
import com.app.model.Connection;
import com.app.repository.ConnectionRepository;
import com.app.service.ApiGatewayService;
import com.app.service.S3Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import lombok.RequiredArgsConstructor;

import io.quarkus.logging.Log;
import software.amazon.awssdk.services.apigatewaymanagementapi.model.GoneException;

import java.util.List;
import java.util.Map;

@Named("stream-notifier")
@ApplicationScoped
@RegisterForReflection
@RequiredArgsConstructor
public class StreamNotifierHandler implements RequestHandler<Map<String, Object>, Void> {

    private final ApiGatewayService apiGatewayService;
    private final ConnectionRepository connectionRepository;
    private final S3Service s3Service;
    private final ObjectMapper objectMapper;

    @Override
    @SuppressWarnings("unchecked")
    public Void handleRequest(Map<String, Object> event, Context context) {
        if (event == null || !event.containsKey("Records")) {
            Log.warn("Received event is null or does not contain 'Records' field");
            return null;
        }

        List<Map<String, Object>> records = (List<Map<String, Object>>) event.get("Records");
        if (records == null) {
            Log.warn("Records field is present but value is null");
            return null;
        }

        for (Map<String, Object> record : records) {
            String eventName = (String) record.get("eventName");

            if ("INSERT".equals(eventName))
                this.processInsert(record);
            else if ("REMOVE".equals(eventName))
                this.processRemove(record);
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private void processInsert(Map<String, Object> record) {
        Map<String, Object> dynamodb = (Map<String, Object>) record.get("dynamodb");
        if (dynamodb == null || !dynamodb.containsKey("NewImage")) {
            Log.warn("processInsert ignored: dynamodb block is null or missing NewImage");
            return;
        }

        Map<String, Object> newImage = (Map<String, Object>) dynamodb.get("NewImage");
        if (newImage == null) {
            Log.warn("processInsert ignored: NewImage value is null");
            return;
        }

        String userId = this.getStringAttribute(newImage, "userId");
        if (userId == null) {
            Log.warn("processInsert ignored: userId attribute is null");
            return;
        }

        String messageId = this.getStringAttribute(newImage, "messageId");
        String createdAt = this.getStringAttribute(newImage, "createdAt");
        String type = this.getStringAttribute(newImage, "type");
        String content = this.getStringAttribute(newImage, "content");
        String fileName = this.getStringAttribute(newImage, "fileName");
        Long sizeBytes = this.getNumberAttribute(newImage, "sizeBytes");
        String s3Key = this.getStringAttribute(newImage, "s3Key");

        String downloadUrl = null;
        if (s3Key != null && !s3Key.isBlank())
            downloadUrl = this.s3Service.generatePresignedGetUrl(s3Key);

        ListMessagesResponse.MessageItem messageItem = ListMessagesResponse.MessageItem.builder()
                .messageId(messageId)
                .userId(userId)
                .createdAt(createdAt)
                .type(type)
                .content(content)
                .fileName(fileName)
                .sizeBytes(sizeBytes)
                .downloadUrl(downloadUrl)
                .build();

        String data;
        try {
            Map<String, Object> envelope = Map.of(
                    "type", "new_message",
                    "message", messageItem);
            data = this.objectMapper.writeValueAsString(envelope);
        } catch (Exception e) {
            Log.error("Error serializing notification message", e);
            return;
        }

        List<Connection> connections = this.connectionRepository.findByUserId(userId);
        Log.infof("Found %d connections for userId: %s", connections.size(), userId);

        for (Connection connection : connections) {
            try {
                this.apiGatewayService.sendToConnection(connection.getConnectionId(), data);
                Log.infof("Notification sent to connection: %s", connection.getConnectionId());
            } catch (Exception e) {
                if (this.isGoneException(e)) {
                    Log.infof("Removing gone connection: %s", connection.getConnectionId());
                    this.connectionRepository.delete(userId, connection.getConnectionId());
                } else
                    Log.errorf("Error sending message to connection %s: %s", connection.getConnectionId(),
                            e.getMessage());
            }
        }
    }

    @SuppressWarnings("unchecked")
    private void processRemove(Map<String, Object> record) {
        Map<String, Object> dynamodb = (Map<String, Object>) record.get("dynamodb");
        if (dynamodb == null || !dynamodb.containsKey("Keys")) {
            Log.warn("processRemove ignored: dynamodb block is null or missing Keys");
            return;
        }

        Map<String, Object> keys = (Map<String, Object>) dynamodb.get("Keys");
        if (keys == null) {
            Log.warn("processRemove ignored: Keys value is null");
            return;
        }

        Map<String, Object> userIdAttr = (Map<String, Object>) keys.get("userId");
        if (userIdAttr == null || !userIdAttr.containsKey("S")) {
            Log.warn("processRemove ignored: userId attribute is null or missing string value 'S'");
            return;
        }

        String userId = (String) userIdAttr.get("S");

        Map<String, Object> createdAtAttr = (Map<String, Object>) keys.get("createdAt");
        if (createdAtAttr == null || !createdAtAttr.containsKey("S")) {
            Log.warn("processRemove ignored: createdAt attribute is null or missing string value 'S'");
            return;
        }

        String createdAt = (String) createdAtAttr.get("S");

        String data = "{\"type\": \"delete_message\", \"createdAt\": \"" + createdAt + "\"}";

        List<Connection> connections = this.connectionRepository.findByUserId(userId);
        Log.infof("Found %d connections for userId: %s for deletion event", connections.size(), userId);

        for (Connection connection : connections) {
            try {
                this.apiGatewayService.sendToConnection(connection.getConnectionId(), data);
                Log.infof("Deletion notification sent to connection: %s", connection.getConnectionId());
            } catch (Exception e) {
                if (this.isGoneException(e)) {
                    Log.infof("Removing gone connection: %s", connection.getConnectionId());
                    this.connectionRepository.delete(userId, connection.getConnectionId());
                } else
                    Log.errorf("Error sending message to connection %s: %s", connection.getConnectionId(),
                            e.getMessage());
            }
        }
    }

    @SuppressWarnings("unchecked")
    private String getStringAttribute(Map<String, Object> image, String attributeName) {
        Object attrObj = image.get(attributeName);
        if (attrObj instanceof Map) {
            Map<String, Object> attrMap = (Map<String, Object>) attrObj;
            if (attrMap.containsKey("S"))
                return (String) attrMap.get("S");
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private Long getNumberAttribute(Map<String, Object> image, String attributeName) {
        Object attrObj = image.get(attributeName);
        if (attrObj instanceof Map) {
            Map<String, Object> attrMap = (Map<String, Object>) attrObj;
            if (attrMap.containsKey("N")) {
                String numStr = (String) attrMap.get("N");
                if (numStr != null && !numStr.isBlank())
                    return Long.valueOf(numStr);
            }
        }
        return null;
    }

    private boolean isGoneException(Exception e) {
        return e instanceof GoneException || (e.getMessage() != null && e.getMessage().contains("Gone"));
    }
}
