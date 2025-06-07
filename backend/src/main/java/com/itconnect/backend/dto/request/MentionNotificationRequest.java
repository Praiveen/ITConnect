package com.itconnect.backend.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MentionNotificationRequest {
    private List<Long> mentionedUserIds;
    private Long boardId;
    private String taskId;
    private String cardTitle;
    private String componentType;
} 