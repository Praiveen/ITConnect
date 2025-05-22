package com.itconnect.backend.controllers;

import com.itconnect.backend.dto.ChatMessageDto;
import com.itconnect.backend.dto.EditMessageRequestDto;
import com.itconnect.backend.dto.SendMessageRequestDto;
import com.itconnect.backend.entities.User;
import com.itconnect.backend.services.ChatService;
import com.itconnect.backend.service.SupabaseS3StorageService;
import com.itconnect.backend.dto.ResponseDto;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.security.Principal;
import java.util.HashMap;
import java.util.Map;

@Controller
@RequiredArgsConstructor
@Slf4j
@RestController
public class ChatMessageController {

    private final SimpMessagingTemplate messagingTemplate;
    private final ChatService chatService;
    private final SupabaseS3StorageService supabaseS3StorageService;


    @MessageMapping("/chat.sendMessage/{chatId}")
    public void sendMessage(@DestinationVariable("chatId") Long chatId,
            @Payload SendMessageRequestDto messagePayload,
            SimpMessageHeaderAccessor headerAccessor) {

        Principal principal = headerAccessor.getUser();
        if (principal == null) {
            log.warn("Received WebSocket message without authenticated user for chat {}", chatId);
            return;
        }

        User currentUser = null;
        if (principal instanceof UsernamePasswordAuthenticationToken) {
            Object principalObj = ((UsernamePasswordAuthenticationToken) principal).getPrincipal();
            if (principalObj instanceof User) {
                currentUser = (User) principalObj;
            }
        }

        if (currentUser == null) {
            log.warn("Could not extract User object from Principal for chat {}", chatId);
            return;
        }

        log.info("Received message to send via WebSocket to chat {}: {} from user {} (replying to: {})", chatId,
                messagePayload.getContent(), currentUser.getUserId(), messagePayload.getParentMessageId());

        try {
            ChatMessageDto savedMessageDto = chatService.sendMessage(
                    chatId,
                    messagePayload.getContent(),
                    messagePayload.getParentMessageId(),
                    currentUser,
                    messagePayload.getAttachmentUrl(),
                    messagePayload.getAttachmentName(),
                    messagePayload.getAttachmentType(),
                    messagePayload.getAttachmentSize()
            );

            if (savedMessageDto != null) {
                messagingTemplate.convertAndSend("/topic/chat/" + chatId, savedMessageDto);
                log.info("Message sent to /topic/chat/{} content: {}", chatId, savedMessageDto.getContent());
            } else {
                log.warn("Failed to save message or user unauthorized for chat {}, message not broadcasted.", chatId);
            }
        } catch (Exception e) {
            log.error("Error processing WebSocket message for chat {}: {}", chatId, e.getMessage(), e);
        }
    }

    @MessageMapping("/chat.typing/{chatId}")
    public void userTyping(@DestinationVariable("chatId") Long chatId,
            @Payload Map<String, String> payload,
            SimpMessageHeaderAccessor headerAccessor) {
        Principal principal = headerAccessor.getUser();
        if (principal == null || !(principal instanceof UsernamePasswordAuthenticationToken))
            return;

        User currentUser = (User) ((UsernamePasswordAuthenticationToken) principal).getPrincipal();
        String username = currentUser.getFullName() != null ? currentUser.getFullName() : currentUser.getEmail();
        boolean isTyping = Boolean.parseBoolean(payload.getOrDefault("isTyping", "false"));

        log.info("User {} is {} in chat {}", username, isTyping ? "typing" : "stopped typing", chatId);

        Map<String, Object> typingEvent = new HashMap<>();
        typingEvent.put("userId", currentUser.getUserId());
        typingEvent.put("username", username);
        typingEvent.put("isTyping", isTyping);

        messagingTemplate.convertAndSend("/topic/chat/" + chatId + "/typing", typingEvent);
    }

    @MessageMapping("/chat.readMessage/{chatId}/{messageId}")
    public void markMessageAsRead(@DestinationVariable("chatId") Long chatId,
            @DestinationVariable("messageId") Long messageId,
            SimpMessageHeaderAccessor headerAccessor) {
        Principal principal = headerAccessor.getUser();
        if (principal == null || !(principal instanceof UsernamePasswordAuthenticationToken))
            return;

        User currentUser = (User) ((UsernamePasswordAuthenticationToken) principal).getPrincipal();
        log.info("User {} marked message {} in chat {} as read via WebSocket", currentUser.getUserId(), messageId,
                chatId);

        try {
            chatService.markMessageAsRead(messageId, currentUser);

            Map<String, Object> readEvent = new HashMap<>();
            readEvent.put("messageId", messageId);
            readEvent.put("readerId", currentUser.getUserId());
            readEvent.put("chatId", chatId);
            messagingTemplate.convertAndSend("/topic/chat/" + chatId + "/messageRead", readEvent);

        } catch (Exception e) {
            log.error("Error marking message as read via WebSocket for chat {}: {}", chatId, e.getMessage(), e);
        }
    }

    @MessageMapping("/chat.editMessage/{chatId}/{messageId}")
    public void editMessage(@DestinationVariable("chatId") Long chatId,
            @DestinationVariable("messageId") Long messageId,
            @Payload EditMessageRequestDto editPayload,
            SimpMessageHeaderAccessor headerAccessor) {
        Principal principal = headerAccessor.getUser();
        if (principal == null) {
            log.warn("Received WebSocket message to edit without authenticated user for chat {}, message {}", chatId,
                    messageId);

            return;
        }

        User currentUser = extractUserFromPrincipal(principal);
        if (currentUser == null) {
            log.warn("Could not extract User object from Principal for chat {}, message {}", chatId, messageId);
            return;
        }

        log.info("User {} attempting to edit message {} in chat {} with new content: {}",
                currentUser.getUserId(), messageId, chatId, editPayload.getContent());

        try {
            ChatMessageDto updatedMessageDto = chatService.editMessage(messageId, editPayload.getContent(),
                    currentUser);

            if (updatedMessageDto != null) {

                Map<String, Object> editEvent = new HashMap<>();
                editEvent.put("type", "MESSAGE_EDITED");
                editEvent.put("chatId", chatId);
                editEvent.put("messageId", updatedMessageDto.getId());
                editEvent.put("payload", updatedMessageDto);

                messagingTemplate.convertAndSend("/topic/chat/" + chatId, editEvent);
                log.info("Message {} in chat {} edited and update broadcasted.", messageId, chatId);
            } else {

                log.warn("Failed to edit message {} in chat {} by user {}. Not broadcasted.", messageId, chatId,
                        currentUser.getUserId());

            }
        } catch (Exception e) {

            log.error("Error processing edit message request for message {} in chat {}: {}", messageId, chatId,
                    e.getMessage(), e);

        }
    }

    /**
     * Метод для обработки удаления сообщения.
     */
    @MessageMapping("/chat.deleteMessage/{chatId}/{messageId}")
    public void deleteMessage(@DestinationVariable("chatId") Long chatId,
            @DestinationVariable("messageId") Long messageId,
            SimpMessageHeaderAccessor headerAccessor) {
        Principal principal = headerAccessor.getUser();
        if (principal == null) {
            log.warn("Received WebSocket message to delete without authenticated user for chat {}, message {}", chatId,
                    messageId);
            return;
        }

        User currentUser = extractUserFromPrincipal(principal);
        if (currentUser == null) {
            log.warn("Could not extract User object from Principal for chat {}, message {}", chatId, messageId);
            return;
        }

        log.info("User {} attempting to delete message {} in chat {}", currentUser.getUserId(), messageId, chatId);

        try {
            chatService.deleteMessage(messageId, currentUser);

            Map<String, Object> deleteEvent = new HashMap<>();
            deleteEvent.put("type", "MESSAGE_DELETED");
            deleteEvent.put("chatId", chatId);
            deleteEvent.put("messageId", messageId);

            messagingTemplate.convertAndSend("/topic/chat/" + chatId, deleteEvent);
            log.info("Message {} in chat {} deleted and update broadcasted.", messageId, chatId);

        } catch (Exception e) {

            log.error("Error processing delete message request for message {} in chat {}: {}", messageId, chatId,
                    e.getMessage(), e);

        }
    }

    private User extractUserFromPrincipal(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken) {
            Object principalObj = ((UsernamePasswordAuthenticationToken) principal).getPrincipal();
            if (principalObj instanceof User) {
                return (User) principalObj;
            }
        }
        return null;
    }

    /**
     * Эндпоинт для загрузки файлов с клиента (только для авторизованных пользователей).
     */
    @PostMapping("/files/upload")
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file) throws Exception {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof User)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }
        String url = supabaseS3StorageService.uploadFile(file);

        Map<String, Object> result = new HashMap<>();
        result.put("url", url);
        result.put("name", file.getOriginalFilename());
        result.put("type", file.getContentType());
        result.put("size", file.getSize());
        return ResponseEntity.ok(result);
    }

    /**
     * Эндпоинт для скачивания файла по messageId (только для авторизованных и имеющих доступ к чату).
     */
    @GetMapping("/files/{messageId}/download")
    public ResponseEntity<?> downloadFile(@PathVariable("messageId") Long messageId) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof User)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }
        User user = (User) authentication.getPrincipal();

        ChatMessageDto message = chatService.getMessageByIdAndUser(messageId, user);
        if (message == null || message.getAttachmentUrl() == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ResponseDto("Файл не найден или нет доступа", false));
        }

        try {
            InputStreamResource resource = supabaseS3StorageService.downloadFileAsResource(message.getAttachmentUrl());

            String filename = message.getAttachmentName() != null ? message.getAttachmentName() : "file";
            String contentType = message.getAttachmentType() != null ? message.getAttachmentType() : "application/octet-stream";

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.parseMediaType(contentType))
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ResponseDto("Ошибка при скачивании файла: " + e.getMessage(), false));
        }
    }
}