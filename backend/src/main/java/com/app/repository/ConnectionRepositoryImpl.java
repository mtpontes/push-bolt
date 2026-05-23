package com.app.repository;

import com.app.model.Connection;
import jakarta.enterprise.context.ApplicationScoped;
import lombok.RequiredArgsConstructor;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.enhanced.dynamodb.model.QueryConditional;

import java.util.List;
import java.util.stream.Collectors;

@ApplicationScoped
@RequiredArgsConstructor
public class ConnectionRepositoryImpl implements ConnectionRepository {

    private String getTableName() {
        String envValue = System.getenv("CONNECTIONS_TABLE_NAME");
        if (envValue != null && !envValue.isEmpty()) {
            return envValue;
        }
        return org.eclipse.microprofile.config.ConfigProvider.getConfig().getValue("app.dynamodb.table-connections", String.class);
    }

    private static final TableSchema<Connection> SCHEMA = TableSchema.fromBean(Connection.class);

    private final DynamoDbEnhancedClient enhancedClient;


    @Override
    public void save(Connection connection) {
        DynamoDbTable<Connection> table = this.enhancedClient.table(this.getTableName(), SCHEMA);
        table.putItem(connection);
    }

    @Override
    public void delete(String userId, String connectionId) {
        DynamoDbTable<Connection> table = this.enhancedClient.table(this.getTableName(), SCHEMA);
        table.deleteItem(r -> r.key(k -> k.partitionValue(userId).sortValue(connectionId)));
    }

    @Override
    public List<Connection> findByUserId(String userId) {
        DynamoDbTable<Connection> table = this.enhancedClient.table(this.getTableName(), SCHEMA);
        return table.query(QueryConditional.keyEqualTo(k -> k.partitionValue(userId)))

                .items()
                .stream()
                .collect(Collectors.toList());
    }
}
