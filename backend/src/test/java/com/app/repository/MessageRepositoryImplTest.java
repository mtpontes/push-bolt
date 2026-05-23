package com.app.repository;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

public class MessageRepositoryImplTest {

    @Test
    @DisplayName("Given valid partition and sort keys, when encoded and then decoded, then should return the original key map")
    void testEncodeDecodeRoundtrip() {
        // Arrange
        MessageRepositoryImpl repository = new MessageRepositoryImpl(null);
        Map<String, AttributeValue> originalKey = new HashMap<>();
        originalKey.put("userId", AttributeValue.builder().s("user-abc").build());
        originalKey.put("createdAt", AttributeValue.builder().s("2026-05-17T12:00:00.000Z").build());

        // Act
        String token = repository.encodeNextToken(originalKey);
        Map<String, AttributeValue> decodedKey = repository.decodeNextToken(token);

        // Assert
        assertNotNull(token);
        assertNotNull(decodedKey);
        assertEquals("user-abc", decodedKey.get("userId").s());
        assertEquals("2026-05-17T12:00:00.000Z", decodedKey.get("createdAt").s());
    }

    @Test
    @DisplayName("Given null or empty lastEvaluatedKey, when encoded, then should return null")
    void testEncodeNullOrEmpty() {
        // Arrange
        MessageRepositoryImpl repository = new MessageRepositoryImpl(null);

        // Act
        String nullToken = repository.encodeNextToken(null);
        String emptyToken = repository.encodeNextToken(new HashMap<>());

        // Assert
        assertNull(nullToken);
        assertNull(emptyToken);
    }

    @Test
    @DisplayName("Given invalid or empty tokens, when decoded, then should return null")
    void testDecodeInvalidTokens() {
        // Arrange
        MessageRepositoryImpl repository = new MessageRepositoryImpl(null);

        // Act
        Map<String, AttributeValue> nullResult = repository.decodeNextToken(null);
        Map<String, AttributeValue> emptyResult = repository.decodeNextToken("");
        Map<String, AttributeValue> invalidBase64Result = repository.decodeNextToken("invalid-base-64!!!");
        Map<String, AttributeValue> badFormatResult = repository.decodeNextToken("dXNlcklkX2NyZWF0ZWRBdA=="); // Base64 of "userId_createdAt" (no "##")

        // Assert
        assertNull(nullResult);
        assertNull(emptyResult);
        assertNull(invalidBase64Result);
        assertNull(badFormatResult);
    }
}
