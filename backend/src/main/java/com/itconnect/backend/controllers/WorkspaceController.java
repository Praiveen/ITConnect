package com.itconnect.backend.controllers;

import com.itconnect.backend.dto.ResponseDto;
import com.itconnect.backend.dto.WorkspaceDto;
import com.itconnect.backend.entities.Notification;
import com.itconnect.backend.entities.User;
import com.itconnect.backend.entities.WorkspaceRole;
import com.itconnect.backend.services.UserService;
import com.itconnect.backend.services.WorkspaceService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/workspaces")
public class WorkspaceController {

    private final WorkspaceService workspaceService;
    private final UserService userService;

    public WorkspaceController(WorkspaceService workspaceService, UserService userService) {
        this.workspaceService = workspaceService;
        this.userService = userService;
    }

    /**
     * Получить все рабочие области текущего пользователя
     */
    @GetMapping
    public ResponseEntity<?> getAllWorkspaces() {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }

        List<WorkspaceDto> workspaces = workspaceService.getAllWorkspacesByUser(currentUser);

        System.out.println("В контроллере получены рабочие пространства: " + workspaces.size());
        for (WorkspaceDto workspace : workspaces) {
            System.out.println("Workspace ID: " + workspace.getId() +
                    ", name: " + workspace.getName() +
                    ", owner flag: " + workspace.isOwner());
        }

        return ResponseEntity.ok(workspaces);
    }

    /**
     * Получить рабочую область по ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getWorkspace(@PathVariable("id") Long id) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }
        WorkspaceDto workspace = workspaceService.getWorkspaceById(id, currentUser);
        System.out.println(workspace);
        System.out.println("getWorkspaccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccce");
        if (workspace == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ResponseDto("Рабочая область не найдена", false));
        }

        return ResponseEntity.ok(workspace);
    }

    /**
     * Создать новую рабочую область
     */
    @PostMapping
    public ResponseEntity<?> createWorkspace(@RequestBody WorkspaceDto workspaceDto) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }

        if (workspaceDto.getName() == null || workspaceDto.getName().trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new ResponseDto("Название рабочей области обязательно", false));
        }

        WorkspaceDto createdWorkspace = workspaceService.createWorkspace(
                workspaceDto.getName(),
                workspaceDto.getDescription(),
                currentUser);

        return ResponseEntity.status(HttpStatus.CREATED).body(createdWorkspace);
    }

    /**
     * Обновить существующую рабочую область
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateWorkspace(@PathVariable("id") Long id, @RequestBody WorkspaceDto workspaceDto) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }

        WorkspaceDto updatedWorkspace = workspaceService.updateWorkspace(
                id,
                workspaceDto.getName(),
                workspaceDto.getDescription(),
                currentUser);

        if (updatedWorkspace == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ResponseDto("Рабочая область не найдена или недостаточно прав", false));
        }

        return ResponseEntity.ok(updatedWorkspace);
    }

    /**
     * Удалить рабочую область
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteWorkspace(@PathVariable("id") Long id) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }

        boolean deleted = workspaceService.deleteWorkspace(id, currentUser);
        if (!deleted) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ResponseDto("Рабочая область не найдена или недостаточно прав", false));
        }

        return ResponseEntity.ok(new ResponseDto("Рабочая область успешно удалена", true));
    }

    /**
     * Добавить участника в рабочую область
     */
    @PostMapping("/{id}/members")
    public ResponseEntity<?> addMember(@PathVariable("id") Long id, @RequestBody Map<String, Object> request) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }

        Long userId = Long.valueOf(request.get("userId").toString());
        String roleStr = request.get("role").toString();
        WorkspaceRole role;

        try {
            role = WorkspaceRole.valueOf(roleStr);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(new ResponseDto("Некорректная роль. Доступные роли: ADMIN, MEMBER, VIEWER", false));
        }

        boolean added = workspaceService.addMember(id, userId, role, currentUser);
        if (!added) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ResponseDto("Не удалось добавить участника", false));
        }

        return ResponseEntity.ok(new ResponseDto("Участник успешно добавлен", true));
    }

    /**
     * Удалить участника из рабочей области
     */
    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<?> removeMember(@PathVariable("id") Long id, @PathVariable("userId") Long userId) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }

        boolean removed = workspaceService.removeMember(id, userId, currentUser);
        if (!removed) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ResponseDto("Не удалось удалить участника", false));
        }

        return ResponseEntity.ok(new ResponseDto("Участник успешно удален", true));
    }

    @PutMapping("/{id}/members/{userId}/role")
    public ResponseEntity<?> changeMemberRole(@PathVariable("id") Long id, @PathVariable("userId") Long userId,
            @RequestBody Map<String, Object> request) {
        try {

            User currentUser = getCurrentUser();
            if (currentUser == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ResponseDto("Пользователь не авторизован", false));
            }
            if (!request.containsKey("role")) {
                return ResponseEntity.badRequest()
                        .body(new ResponseDto("Не указана роль пользователя", false));
            }

            String role = (String) request.get("role");

            try {
                WorkspaceRole.valueOf(role);
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest()
                        .body(new ResponseDto("Не верное значение роли", false));
            }

            boolean success = workspaceService.changeMemberRole(id, userId, role, currentUser);

            if (success) {
                return ResponseEntity.ok(new ResponseDto("Роль пользователя успешно изменена", true));
            } else {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ResponseDto("Не удалось изменить роль", true));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ResponseDto("Произошла ошибка при изменении роли пользователя", false));
        }
    }

    /**
     * Пригласить пользователя в рабочую область
     */
    @PostMapping("/{id}/invitations")
    public ResponseEntity<?> inviteUser(@PathVariable("id") Long id, @RequestBody Map<String, Object> request) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }

        String email = request.get("email").toString();
        String roleStr = request.get("role").toString();
        WorkspaceRole role;

        try {
            role = WorkspaceRole.valueOf(roleStr);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(new ResponseDto("Некорректная роль. Доступные роли: ADMIN, MEMBER, VIEWER", false));
        }

        Notification invitation = workspaceService.inviteUser(id, email, role, currentUser);

        if (invitation == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ResponseDto("Не удалось отправить приглашение", false));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Приглашение успешно отправлено");

        Map<String, Object> invitationData = new HashMap<>();
        invitationData.put("id", invitation.getId());
        invitationData.put("type", invitation.getType());
        invitationData.put("message", invitation.getMessage());
        invitationData.put("createdAt", invitation.getCreatedAt());

        invitationData.put("email", email);
        invitationData.put("role", roleStr);

        response.put("invitation", invitationData);

        return ResponseEntity.ok(response);
    }

    /**
     * Получить текущего аутентифицированного пользователя
     */
    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof User) {
            return (User) authentication.getPrincipal();
        }
        return null;
    }
}