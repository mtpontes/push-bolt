package com.app.repository;

import com.app.model.Message;
import com.app.model.PagedResult;

public interface MessageRepository {
    void save(Message message);

    PagedResult<Message> findByUserId(String userId, String nextToken);

    Message findById(String userId, String createdAt);

    void delete(String userId, String createdAt);
}
