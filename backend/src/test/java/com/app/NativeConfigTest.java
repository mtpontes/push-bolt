package com.app;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.s3.S3Client;

import jakarta.inject.Inject;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@QuarkusTest
public class NativeConfigTest {

    @Inject
    DynamoDbClient dynamoDbClient;

    @Inject
    S3Client s3Client;

    @Test
    public void testAwsClientsInjected() {
        assertNotNull(dynamoDbClient, "DynamoDbClient should be injected");
        assertNotNull(s3Client, "S3Client should be injected");
    }
}
