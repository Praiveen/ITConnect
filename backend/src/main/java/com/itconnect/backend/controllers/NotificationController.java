package com.itconnect.backend.controllers;

import com.itconnect.backend.dto.NotificationDto;
import com.itconnect.backend.dto.ResponseDto;
import com.itconnect.backend.entities.Notification;
import com.itconnect.backend.entities.User;
import com.itconnect.backend.services.NotificationService;
import com.itconnect.backend.services.UserService;
import com.itconnect.backend.services.WorkspaceService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/notifications")
public class NotificationController {

    private final NotificationService notificationService;
    private final WorkspaceService workspaceService;
    private final UserService userService;

    @Autowired
    public NotificationController(NotificationService notificationService,
            WorkspaceService workspaceService,
            UserService userService) {
        this.notificationService = notificationService;
        this.workspaceService = workspaceService;
        this.userService = userService;
    }

    /**
     * Получить все уведомления для текущего пользователя
     */
    @GetMapping
    public ResponseEntity<?> getAllNotifications() {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }

        List<Notification> notifications = notificationService.getAllNotifications(currentUser);
        List<NotificationDto> notificationDtos = NotificationDto.fromEntities(notifications);
        return ResponseEntity.ok(notificationDtos);
    }

    /**
     * Получить непрочитанные уведомления для текущего пользователя
     */
    @GetMapping("/unread")
    public ResponseEntity<?> getUnreadNotifications() {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }

        List<Notification> notifications = notificationService.getUnreadNotifications(currentUser);
        List<NotificationDto> notificationDtos = NotificationDto.fromEntities(notifications);
        return ResponseEntity.ok(notificationDtos);
    }

    /**
     * Получить активные приглашения в рабочие пространства
     */
    @GetMapping("/workspace-invitations")
    public ResponseEntity<?> getWorkspaceInvitations() {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }

        List<Notification> invitations = notificationService.getActiveWorkspaceInvitations(currentUser);
        List<NotificationDto> invitationDtos = NotificationDto.fromEntities(invitations);
        return ResponseEntity.ok(invitationDtos);
    }

    /**
     * Принять приглашение в рабочее пространство
     */
    @PostMapping("/{id}/accept")
    public ResponseEntity<?> acceptWorkspaceInvitation(@PathVariable("id") Long id) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }

        boolean accepted = workspaceService.acceptInvitation(id, currentUser);
        if (accepted) {
            return ResponseEntity.ok(new ResponseDto("Приглашение принято успешно", true));
        } else {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ResponseDto(
                            "Невозможно принять приглашение. Проверьте, не истекло ли оно или уже обработано", false));
        }
    }

    /**
     * Отклонить приглашение в рабочее пространство
     */
    @PostMapping("/{id}/decline")
    public ResponseEntity<?> declineWorkspaceInvitation(@PathVariable("id") Long id) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }

        boolean declined = workspaceService.declineInvitation(id, currentUser);
        if (declined) {
            return ResponseEntity.ok(new ResponseDto("Приглашение отклонено успешно", true));
        } else {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ResponseDto(
                            "Невозможно отклонить приглашение. Проверьте, не истекло ли оно или уже обработано",
                            false));
        }
    }

    /**
     * Отметить уведомление как прочитанное
     */
    @PostMapping("/{id}/read")
    public ResponseEntity<?> markAsRead(@PathVariable("id") Long id) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }

        boolean marked = notificationService.markAsRead(id, currentUser);
        if (marked) {
            return ResponseEntity.ok(new ResponseDto("Уведомление отмечено как прочитанное", true));
        } else {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ResponseDto("Уведомление не найдено или не принадлежит текущему пользователю", false));
        }
    }

    /**
     * Отметить все уведомления как прочитанные
     */
    @PostMapping("/read-all")
    public ResponseEntity<?> markAllAsRead() {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }

        notificationService.markAllAsRead(currentUser);
        return ResponseEntity.ok(new ResponseDto("Все уведомления отмечены как прочитанные", true));
    }

    /**
     * Удалить уведомление
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteNotification(@PathVariable("id") Long id) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }

        boolean deleted = notificationService.deleteNotification(id, currentUser);
        if (deleted) {
            return ResponseEntity.ok(new ResponseDto("Уведомление удалено", true));
        } else {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ResponseDto("Уведомление не найдено или не принадлежит текущему пользователю", false));
        }
    }

    /**
     * Получение текущего пользователя из SecurityContext
     */
    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof User) {
            return (User) authentication.getPrincipal();
        }
        return null;
    }
}