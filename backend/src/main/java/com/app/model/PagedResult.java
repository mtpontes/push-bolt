package com.app.model;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class PagedResult<T> {
    private List<T> items;
    private String nextToken;
}
