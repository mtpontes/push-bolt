package com.app.service;

public interface S3Service {
    String generatePresignedGetUrl(String s3Key);
    String generatePutPresignedUrl(String s3Key, String mimeType);
    void deleteObject(String s3Key);
    Long getObjectSize(String s3Key);
}
