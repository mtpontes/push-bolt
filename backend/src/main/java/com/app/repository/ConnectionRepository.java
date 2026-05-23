package com.app.repository;

import com.app.model.Connection;
import java.util.List;

public interface ConnectionRepository {
    void save(Connection connection);
    void delete(String userId, String connectionId);
    List<Connection> findByUserId(String userId);
}
