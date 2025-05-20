package com.itconnect.backend.controllers;

import com.itconnect.backend.dto.ChatDto;
import com.itconnect.backend.dto.ResponseDto;
import com.itconnect.backend.entities.User;
import com.itconnect.backend.services.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/chats")
@RequiredArgsConstructor
public class UserChatController {

    private final ChatService chatService;

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof User) {
            return (User) authentication.getPrincipal();
        }
        return null;
    }

    /**
     * Получение всех чатов текущего пользователя из всех его рабочих пространств
     */
    @GetMapping("/all")
    public ResponseEntity<?> getAllUserChats() {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }
        try {
            List<ChatDto> chats = chatService.getAllUserChats(currentUser);
            return ResponseEntity.ok(chats);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ResponseDto("Ошибка при получении списка всех чатов пользователя: " + e.getMessage(),
                            false));
        }
    }
}