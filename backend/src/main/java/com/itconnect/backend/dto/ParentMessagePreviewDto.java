package com.itconnect.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ParentMessagePreviewDto {
    private Long id;
    private String senderName;
    private String contentPreview;
} 