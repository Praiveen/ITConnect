package com.itconnect.backend.controllers;

import com.itconnect.backend.dto.ChatDto;
import com.itconnect.backend.dto.ChatMessageDto;
import com.itconnect.backend.dto.CreateChatRequestDto;
import com.itconnect.backend.dto.UpdateChatRequestDto;
import com.itconnect.backend.dto.SendMessageRequestDto;
import com.itconnect.backend.dto.ResponseDto;
import com.itconnect.backend.entities.User;
import com.itconnect.backend.services.ChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.hibernate.engine.internal.Collections;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;


import java.util.List;

@RestController
@RequestMapping("/workspaces/{workspaceId}/chats")
@RequiredArgsConstructor
@Slf4j
public class ChatController {

    private final ChatService chatService;

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof User) {
            return (User) authentication.getPrincipal();
        }
        return null;
    }


    @PostMapping
    public ResponseEntity<?> createChat(
            @PathVariable("workspaceId") Long workspaceId,
            @RequestBody CreateChatRequestDto createChatRequestDto) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }
        try {
            ChatDto createdChat = chatService.createChat(workspaceId, createChatRequestDto, currentUser);
            if (createdChat == null) {
                 return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ResponseDto("Не удалось создать чат. Проверьте права доступа или ID рабочего пространства.", false));
            }
            return new ResponseEntity<>(createdChat, HttpStatus.CREATED);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR) 
                    .body(new ResponseDto("Ошибка при создании чата: " + e.getMessage(), false));
        }
    }

   
    @GetMapping
    public ResponseEntity<?> getChatsByWorkspace(@PathVariable("workspaceId") Long workspaceId) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }
        try {
            List<ChatDto> chats = chatService.getChatsByWorkspace(workspaceId, currentUser);
            return ResponseEntity.ok(chats);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ResponseDto("Ошибка при получении списка чатов: " + e.getMessage(), false));
        }
    }

   
    @GetMapping("/{chatId}")
    public ResponseEntity<?> getChatById(
            @PathVariable("workspaceId") Long workspaceId,
            @PathVariable("chatId") Long chatId) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }
        try {
            ChatDto chat = chatService.getChatById(workspaceId, chatId, currentUser);
            if (chat == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ResponseDto("Чат не найден или недостаточно прав", false));
            }
            return ResponseEntity.ok(chat);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR) 
                    .body(new ResponseDto("Ошибка при получении чата: " + e.getMessage(), false));
        }
    }

   
    @PostMapping("/{chatId}/messages")
    public ResponseEntity<?> sendMessage(
            @PathVariable("workspaceId") Long workspaceId, 
            @PathVariable("chatId") Long chatId,
            @RequestBody SendMessageRequestDto sendMessageRequestDto) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }
        try {
            ChatDto chatDto = chatService.getChatById(workspaceId, chatId, currentUser);
            if (chatDto == null) {
                 return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new ResponseDto("Доступ к чату запрещен или чат не найден в данном рабочем пространстве.", false));
            }
            
            ChatMessageDto sentMessage = chatService.sendMessage(chatId, sendMessageRequestDto.getContent(), currentUser);
            if (sentMessage == null) {
                 return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ResponseDto("Не удалось отправить сообщение. Возможно, чат не найден или нет прав.", false));
            }
            return new ResponseEntity<>(sentMessage, HttpStatus.CREATED);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ResponseDto("Ошибка при отправке сообщения: " + e.getMessage(), false));
        }
    }

   
    @GetMapping("/{chatId}/messages")
    public ResponseEntity<?> getMessagesByChat(
            @PathVariable("workspaceId") Long workspaceId,
            @PathVariable("chatId") Long chatId,
            @PageableDefault(size = 20, sort = "sentAt", direction = Sort.Direction.ASC) Pageable pageable) {
        System.out.println("getMessagesByChatssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
        log.info("getMessagesByChat CALLED");
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }
        try {
            ChatDto chatDto = chatService.getChatById(workspaceId, chatId, currentUser);
            if (chatDto == null) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ResponseDto("Доступ к сообщениям чата запрещен или чат не найден.", false));
            }
            Page<ChatMessageDto> messages = chatService.getMessagesByChat(chatId, currentUser, pageable);
            // if (messages == null) {
            //     return ResponseEntity.ok(Page.empty(pageable));
            // }
            return ResponseEntity.ok(messages);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ResponseDto("Ошибка при получении сообщений: " + e.getMessage(), false));
        }
    }

   
    @PutMapping("/{chatId}")
    public ResponseEntity<?> updateChat(
            @PathVariable("workspaceId") Long workspaceId,
            @PathVariable("chatId") Long chatId,
            @RequestBody UpdateChatRequestDto updateChatRequestDto) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }
        try {
            ChatDto updatedChat = chatService.updateChat(workspaceId, chatId, updateChatRequestDto, currentUser);
            return ResponseEntity.ok(updatedChat);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ResponseDto(e.getMessage(), false));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ResponseDto("Ошибка при обновлении чата: " + e.getMessage(), false));
        }
    }

   
    @PostMapping("/{chatId}/messages/{messageId}/read")
    public ResponseEntity<?> markMessageAsRead(
            @PathVariable("workspaceId") Long workspaceId,
            @PathVariable("chatId") Long chatId,
            @PathVariable("messageId") Long messageId) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }
        try {
            ChatDto chatDto = chatService.getChatById(workspaceId, chatId, currentUser);
            if (chatDto == null) {
                 return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new ResponseDto("Доступ к чату запрещен для отметки сообщений.", false));
            }
            boolean success = chatService.markMessageAsRead(messageId, currentUser);
            if (!success) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ResponseDto("Не удалось отметить сообщение как прочитанное. Возможно, сообщение не найдено или нет прав.", false));
            }
            return ResponseEntity.ok(new ResponseDto("Сообщение отмечено как прочитанное.", true));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ResponseDto("Ошибка при отметке сообщения как прочитанного: " + e.getMessage(), false));
        }
    }

    @DeleteMapping("/{chatId}")
    public ResponseEntity<?> deleteChat(
            @PathVariable("workspaceId") Long workspaceId,
            @PathVariable("chatId") Long chatId) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ResponseDto("Пользователь не авторизован", false));
        }
        try {
            boolean deleted = chatService.deleteChat(workspaceId, chatId, currentUser);
            if (deleted) {
                return ResponseEntity.ok(new ResponseDto("Чат успешно удалён.", true));
            } else {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ResponseDto("Не удалось удалить чат. Проверьте права доступа или ID чата.", false));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ResponseDto("Ошибка при удалении чата: " + e.getMessage(), false));
        }
    }
} 