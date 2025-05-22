package com.itconnect.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Builder;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SendMessageRequestDto { 
    private String content;
    private Long parentMessageId;

    private String attachmentUrl;
    private String attachmentName;
    private String attachmentType;
    private Long attachmentSize;
} 