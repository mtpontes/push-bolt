package com.app.repository;

import com.app.model.Message;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import lombok.RequiredArgsConstructor;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.enhanced.dynamodb.model.QueryConditional;
import software.amazon.awssdk.enhanced.dynamodb.model.QueryEnhancedRequest;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;

import java.util.Map;

import com.app.model.PagedResult;
import software.amazon.awssdk.enhanced.dynamodb.model.Page;
import software.amazon.awssdk.enhanced.dynamodb.model.PageIterable;

import java.util.Base64;
import java.util.Iterator;

@ApplicationScoped
@RequiredArgsConstructor
public class MessageRepositoryImpl implements MessageRepository {

    private String getTableName() {
        String envValue = System.getenv("MESSAGES_TABLE_NAME");
        if (envValue != null && !envValue.isEmpty()) {
            return envValue;
        }
        return org.eclipse.microprofile.config.ConfigProvider.getConfig().getValue("app.dynamodb.table-messages", String.class);
    }

    private static final TableSchema<Message> SCHEMA = TableSchema.fromBean(Message.class);

    private final DynamoDbEnhancedClient enhancedClient;

    @Override
    public void save(Message message) {
        DynamoDbTable<Message> table = this.enhancedClient.table(this.getTableName(), SCHEMA);
        table.putItem(message);
    }

    @Override
    public Message findById(String userId, String createdAt) {
        DynamoDbTable<Message> table = this.enhancedClient.table(this.getTableName(), SCHEMA);
        return table.getItem(r -> r.key(k -> k.partitionValue(userId).sortValue(createdAt)));
    }

    @Override
    public void delete(String userId, String createdAt) {
        DynamoDbTable<Message> table = this.enhancedClient.table(this.getTableName(), SCHEMA);
        table.deleteItem(r -> r.key(k -> k.partitionValue(userId).sortValue(createdAt)));
    }

    @Override
    public PagedResult<Message> findByUserId(String userId, String nextToken) {
        DynamoDbTable<Message> table = this.enhancedClient.table(this.getTableName(), SCHEMA);


        QueryEnhancedRequest.Builder requestBuilder = QueryEnhancedRequest.builder()
                .queryConditional(QueryConditional.keyEqualTo(k -> k.partitionValue(userId)))
                .scanIndexForward(false) // Descending order
                .limit(20); // Default limit

        if (nextToken != null && !nextToken.isEmpty())
            requestBuilder.exclusiveStartKey(this.decodeNextToken(nextToken));

        PageIterable<Message> pages = table.query(requestBuilder.build());
        Iterator<Page<Message>> iterator = pages.iterator();

        if (iterator.hasNext()) {
            Page<Message> firstPage = iterator.next();
            return PagedResult.<Message>builder()
                    .items(firstPage.items())
                    .nextToken(this.encodeNextToken(firstPage.lastEvaluatedKey()))
                    .build();
        }

        return PagedResult.<Message>builder()
                .items(List.of())
                .build();
    }

    String encodeNextToken(Map<String, AttributeValue> lastEvaluatedKey) {
        if (lastEvaluatedKey == null || lastEvaluatedKey.isEmpty())
            return null;
        try {
            AttributeValue userIdVal = lastEvaluatedKey.get("userId");
            AttributeValue createdAtVal = lastEvaluatedKey.get("createdAt");
            if (userIdVal == null || createdAtVal == null)
                return null;
            String combined = userIdVal.s() + "##" + createdAtVal.s();
            return Base64.getEncoder().encodeToString(combined.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (Exception e) {
            return null;
        }
    }

    Map<String, AttributeValue> decodeNextToken(String nextToken) {
        if (nextToken == null || nextToken.isEmpty())
            return null;
        try {
            byte[] decodedBytes = Base64.getDecoder().decode(nextToken);
            String combined = new String(decodedBytes, java.nio.charset.StandardCharsets.UTF_8);
            String[] parts = combined.split("##", 2);
            if (parts.length != 2)
                return null;
            var key = new java.util.HashMap<String, AttributeValue>();
            key.put("userId", AttributeValue.builder().s(parts[0]).build());
            key.put("createdAt", AttributeValue.builder().s(parts[1]).build());
            return key;
        } catch (Exception e) {
            return null;
        }
    }
}
