package com.app.model;

import io.quarkus.runtime.annotations.RegisterForReflection;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbBean;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSortKey;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@DynamoDbBean
@RegisterForReflection
public class Connection {
    private String userId;
    private String connectionId;
    private String connectedAt;
    private Long ttl;

    @DynamoDbPartitionKey
    public String getUserId() {
        return this.userId;
    }

    @DynamoDbSortKey
    public String getConnectionId() {
        return this.connectionId;
    }
}
