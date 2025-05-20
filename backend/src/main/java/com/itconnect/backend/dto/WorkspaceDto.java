package com.itconnect.backend.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
public class WorkspaceDto {
    private Long id;
    private String name;
    private String description;
    private Long ownerId;
    private String ownerName;
    private String role;
    private int membersCount;
    private boolean owner;
    private List<Map<String, Object>> members;
    
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date createdAt;
    
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date updatedAt;
} 