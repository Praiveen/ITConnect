package com.itconnect.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessageDto {
    private Long id;
    private Long chatId;
    private Long senderId;
    private String senderName;
    private String content;
    private LocalDateTime editedAt;
    private LocalDateTime sentAt;
    private List<Long> readByUsersIds;
    private ParentMessagePreviewDto parentMessagePreview;
} 