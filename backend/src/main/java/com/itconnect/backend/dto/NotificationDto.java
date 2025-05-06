package com.itconnect.backend.dto;

import com.itconnect.backend.entities.Notification;
import com.itconnect.backend.entities.User;
import com.itconnect.backend.entities.Workspace;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NotificationDto {
    private Long id;
    private String message;
    private String type;
    
    // Информация об отправителе (только необходимые данные)
    private Long senderId;
    private String senderFullName;
    
    // Время создания и обновления
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Статус
    private boolean read;
    private boolean completed;
    
    // Ссылка на сущность
    private Long referenceId;
    private String referenceType;
    
    // Дополнительные поля для приглашений в рабочие пространства
    private WorkspaceInfoDto workspace;
    private String role;
    private Date expiresAt;
    
    // Вспомогательный класс для передачи минимальной информации о рабочем пространстве
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WorkspaceInfoDto {
        private Long id;
        private String name;
        private String description;
        private Long ownerId;
        private String ownerName;
    }
    
    // Преобразование из Entity в DTO
    public static NotificationDto fromEntity(Notification notification) {
        NotificationDto dto = new NotificationDto();
        dto.setId(notification.getId());
        dto.setMessage(notification.getMessage());
        dto.setType(notification.getType());
        
        // Заполняем данные об отправителе, если они есть
        if (notification.getSender() != null) {
            dto.setSenderId(notification.getSender().getUserId());
            dto.setSenderFullName(notification.getSender().getFullName());
        }
        
        dto.setCreatedAt(notification.getCreatedAt());
        dto.setUpdatedAt(notification.getUpdatedAt());
        dto.setRead(notification.isRead());
        dto.setCompleted(notification.isCompleted());
        dto.setReferenceId(notification.getReferenceId());
        dto.setReferenceType(notification.getReferenceType());
        
        // Если это приглашение в рабочее пространство, добавляем информацию о воркспейсе
        if (notification.getWorkspace() != null) {
            Workspace workspace = notification.getWorkspace();
            WorkspaceInfoDto workspaceInfo = new WorkspaceInfoDto(
                workspace.getId(),
                workspace.getName(),
                workspace.getDescription(),
                workspace.getOwner() != null ? workspace.getOwner().getUserId() : null,
                workspace.getOwner() != null ? workspace.getOwner().getFullName() : null
            );
            dto.setWorkspace(workspaceInfo);
        }
        
        dto.setRole(notification.getRole());
        dto.setExpiresAt(notification.getExpiresAt());
        
        return dto;
    }
    
    // Преобразование списка Entity в список DTO
    public static List<NotificationDto> fromEntities(List<Notification> notifications) {
        return notifications.stream()
                .map(NotificationDto::fromEntity)
                .collect(Collectors.toList());
    }
} 