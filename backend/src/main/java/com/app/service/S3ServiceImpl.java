package com.app.service;

import jakarta.enterprise.context.ApplicationScoped;
import java.time.Duration;

import org.eclipse.microprofile.config.ConfigProvider;

import io.quarkus.runtime.annotations.RegisterForReflection;
import lombok.RequiredArgsConstructor;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;

import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;

@ApplicationScoped
@RequiredArgsConstructor
@RegisterForReflection
public class S3ServiceImpl implements S3Service {

    private final S3Presigner presigner;
    private final S3Client s3Client;

    @Override
    public void deleteObject(String s3Key) {
        DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                .bucket(this.getBucketName())
                .key(s3Key)
                .build();
        this.s3Client.deleteObject(deleteObjectRequest);
    }

    @Override
    public String generatePresignedGetUrl(String s3Key) {
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(this.getBucketName())
                .key(s3Key)
                .build();

        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(15))
                .getObjectRequest(getObjectRequest)
                .build();

        PresignedGetObjectRequest presignedRequest = this.presigner.presignGetObject(presignRequest);
        return presignedRequest.url().toString();
    }

    @Override
    public String generatePutPresignedUrl(String s3Key, String mimeType) {
        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(this.getBucketName())
                .key(s3Key)
                .contentType(mimeType)
                .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(15))
                .putObjectRequest(putObjectRequest)
                .build();

        PresignedPutObjectRequest presignedRequest = this.presigner.presignPutObject(presignRequest);
        return presignedRequest.url().toString();
    }

    @Override
    public Long getObjectSize(String s3Key) {
        HeadObjectRequest headRequest = HeadObjectRequest.builder()
                .bucket(this.getBucketName())
                .key(s3Key)
                .build();
        return this.s3Client.headObject(headRequest).contentLength();
    }

    private String getBucketName() {
        String envValue = System.getenv("STORAGE_BUCKET_NAME");
        if (envValue != null && !envValue.isEmpty()) {
            return envValue;
        }
        return ConfigProvider.getConfig().getValue("app.s3.bucket-name", String.class);
    }
}
