package com.itconnect.backend.services;

import com.itconnect.backend.dto.ChatDto;
import com.itconnect.backend.dto.ChatMessageDto;
import com.itconnect.backend.dto.CreateChatRequestDto;
import com.itconnect.backend.dto.UpdateChatRequestDto;
import com.itconnect.backend.entities.Chat;
import com.itconnect.backend.entities.ChatMessage;
import com.itconnect.backend.entities.User;
import com.itconnect.backend.entities.Workspace;
import com.itconnect.backend.entities.WorkspaceMember;
import com.itconnect.backend.repositories.ChatMessageRepository;
import com.itconnect.backend.repositories.ChatRepository;
import com.itconnect.backend.repositories.UserRepository;
import com.itconnect.backend.repositories.WorkspaceRepository;
import com.itconnect.backend.repositories.WorkspaceMemberRepository;
import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatRepository chatRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository memberRepository;
    private final UserRepository userRepository;

    @Transactional
    public ChatDto createChat(Long workspaceId, CreateChatRequestDto createChatRequestDto, User currentUser) {
        Workspace workspace = workspaceRepository.findById(workspaceId).orElse(null);
        if (workspace == null) {
            return null;
        }

        boolean isOwner = workspace.getOwner() != null &&
                currentUser != null &&
                workspace.getOwner().getUserId() != null &&
                currentUser.getUserId() != null &&
                workspace.getOwner().getUserId().equals(currentUser.getUserId());

        boolean isMember = false;
        if (!isOwner) {
            WorkspaceMember member = memberRepository.findByWorkspaceAndUser(workspace, currentUser);
            isMember = member != null;
        }

        if (!isMember && !isOwner) {
            return null;
        }

        Chat chat = Chat.builder()
                .name(createChatRequestDto.getName())
                .workspace(workspace)
                .creator(currentUser)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        chat = chatRepository.save(chat);
        return convertToChatDto(chat, currentUser.getUserId());
    }

    @Transactional(readOnly = true)
    public List<ChatDto> getChatsByWorkspace(Long workspaceId, User currentUser) {
        Workspace workspace = workspaceRepository.findById(workspaceId).orElse(null);
        if (workspace == null) {
            return List.of();
        }

        boolean isOwner = workspace.getOwner() != null &&
                currentUser != null &&
                workspace.getOwner().getUserId() != null &&
                currentUser.getUserId() != null &&
                workspace.getOwner().getUserId().equals(currentUser.getUserId());

        boolean isMember = false;
        if (!isOwner) {
            WorkspaceMember member = memberRepository.findByWorkspaceAndUser(workspace, currentUser);
            isMember = member != null;
        }

        if (!isOwner && !isMember) {
            System.err.println("User " + currentUser.getUserId() + " is not authorized for workspace " + workspaceId);
            return List.of();
        }


        List<Chat> chats = chatRepository.findByWorkspaceId(workspaceId);
        return chats.stream()
                .map(chat -> convertToChatDto(chat, currentUser.getUserId()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ChatDto> getAllUserChats(User currentUser) {
        if (currentUser == null) {
            return List.of();
        }

        List<Chat> allUserAccessibleChats = chatRepository.findAllByUserAccess(currentUser);

        return allUserAccessibleChats.stream()
                .map(chat -> convertToChatDto(chat, currentUser.getUserId()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ChatDto getChatById(Long workspaceId, Long chatId, User currentUser) {
        Chat chat = chatRepository.findByIdAndWorkspaceId(chatId, workspaceId).orElse(null);
        if (chat == null) {
            return null;
        }

        Workspace workspace = chat.getWorkspace();

        boolean isOwner = workspace.getOwner() != null &&
                currentUser != null &&
                workspace.getOwner().getUserId() != null &&
                currentUser.getUserId() != null &&
                workspace.getOwner().getUserId().equals(currentUser.getUserId());

        boolean isMember = false;
        if (!isOwner) {
            WorkspaceMember member = memberRepository.findByWorkspaceAndUser(workspace, currentUser);
            isMember = member != null;
        }

        if (!isMember && !isOwner) {
            System.err.println("User " + currentUser.getUserId() + " is not authorized to access chat " + chatId);
            return null;
        }
        return convertToChatDto(chat, currentUser.getUserId());
    }

    @Transactional
    public ChatMessageDto sendMessage(Long chatId, String content, User sender) {
        Chat chat = chatRepository.findById(chatId).orElse(null);
        if (chat == null) {
            return null;
        }

        Workspace workspace = chat.getWorkspace();

        boolean isOwner = workspace.getOwner() != null &&
                sender != null &&
                workspace.getOwner().getUserId() != null &&
                sender.getUserId() != null &&
                workspace.getOwner().getUserId().equals(sender.getUserId());

        boolean isMember = false;
        if (!isOwner) {
            WorkspaceMember member = memberRepository.findByWorkspaceAndUser(workspace, sender);
            isMember = member != null;
        }

        if (!isMember && !isOwner) {
            System.err.println("Sender " + sender.getUserId() + " is not a member or owner of chat's workspace "
                    + workspace.getId());
            return null;
        }

        ChatMessage message = ChatMessage.builder()
                .chat(chat)
                .sender(sender)
                .content(content)
                .sentAt(LocalDateTime.now())
                .build();

        message = chatMessageRepository.save(message);

        chat.setUpdatedAt(LocalDateTime.now());
        chatRepository.save(chat);

        return convertToChatMessageDto(message);
    }

    @Transactional(readOnly = true)
    public Page<ChatMessageDto> getMessagesByChat(Long chatId, User currentUser, Pageable pageable) {
        Chat chat = chatRepository.findById(chatId).orElse(null);
        if (chat == null) {
            return Page.empty(pageable);
        }

        Workspace workspace = chat.getWorkspace();

        boolean isOwner = workspace.getOwner() != null &&
                currentUser != null &&
                workspace.getOwner().getUserId() != null &&
                currentUser.getUserId() != null &&
                workspace.getOwner().getUserId().equals(currentUser.getUserId());

        boolean isMember = false;
        if (!isOwner) {
            WorkspaceMember member = memberRepository.findByWorkspaceAndUser(workspace, currentUser);
            isMember = member != null;
        }

        if (!isMember && !isOwner) {
            return Page.empty(pageable);
        }

        Page<ChatMessage> messagesPage = chatMessageRepository.findByChatIdOrderBySentAtAsc(chatId, pageable);
        return messagesPage.map(this::convertToChatMessageDto);
    }

    @Transactional
    public boolean markMessageAsRead(Long messageId, User currentUser) {
        ChatMessage message = chatMessageRepository.findById(messageId).orElse(null);
        if (message == null) {
            return false;
        }

        Chat chat = message.getChat();
        Workspace workspace = chat.getWorkspace();

        boolean isOwner = workspace.getOwner() != null &&
                currentUser != null &&
                workspace.getOwner().getUserId() != null &&
                currentUser.getUserId() != null &&
                workspace.getOwner().getUserId().equals(currentUser.getUserId());

        boolean isMember = false;
        if (!isOwner) {
            WorkspaceMember member = memberRepository.findByWorkspaceAndUser(workspace, currentUser);
            isMember = member != null;
        }

        if (!isMember && !isOwner) {
            System.err.println("User " + currentUser.getUserId() + " is not authorized to mark messages in chat "
                    + chat.getId() + " as read.");
            return false;
        }

        if (!message.getReadByUsersIds().contains(currentUser.getUserId())) {
            message.getReadByUsersIds().add(currentUser.getUserId());
            chatMessageRepository.save(message);
        }
        return true;
    }

    @Transactional
    public ChatMessageDto editMessage(Long messageId, String newContent, User currentUser) {
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found with id: " + messageId));

        if (!message.getSender().getUserId().equals(currentUser.getUserId())) {
            throw new AccessDeniedException(
                    "User " + currentUser.getUserId() + " is not authorized to edit message " + messageId);
        }

        if (newContent == null || newContent.trim().isEmpty()) {
            throw new IllegalArgumentException("Message content cannot be empty.");
        }

        message.setContent(newContent);
        message.setEditedAt(LocalDateTime.now());
        ChatMessage updatedMessage = chatMessageRepository.save(message);

        Chat chat = message.getChat();
        chat.setUpdatedAt(LocalDateTime.now());
        chatRepository.save(chat);

        return convertToChatMessageDto(updatedMessage);
    }

    @Transactional
    public void deleteMessage(Long messageId, User currentUser) {
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found with id: " + messageId));

        if (!message.getSender().getUserId().equals(currentUser.getUserId())) {
            throw new AccessDeniedException(
                    "User " + currentUser.getUserId() + " is not authorized to delete message " + messageId);
        }

        Chat chat = message.getChat();

        chatMessageRepository.delete(message);

        chat.setUpdatedAt(LocalDateTime.now());
        chatRepository.save(chat);
    }

    @Transactional
    public ChatDto updateChat(Long workspaceId, Long chatId, UpdateChatRequestDto updateChatRequestDto, User currentUser) {
        Chat chat = chatRepository.findByIdAndWorkspaceId(chatId, workspaceId)
                .orElseThrow(() -> new RuntimeException("Чат с ID " + chatId + " не найден в рабочем пространстве " + workspaceId));

        Workspace workspace = chat.getWorkspace();

        
        boolean isOwner = workspace.getOwner() != null &&
                currentUser != null &&
                workspace.getOwner().getUserId() != null &&
                currentUser.getUserId() != null &&
                workspace.getOwner().getUserId().equals(currentUser.getUserId());

        boolean isMember = false;
        if (!isOwner) {
            WorkspaceMember member = memberRepository.findByWorkspaceAndUser(workspace, currentUser);
            isMember = member != null;
        }

        if (!isMember && !isOwner) {
            throw new AccessDeniedException("Пользователь " + currentUser.getUserId() + " не авторизован для обновления чата " + chatId);
        }

        
        
        boolean canEdit = isOwner || chat.getCreator().getUserId().equals(currentUser.getUserId());
        
        

        if (!canEdit) {
             throw new AccessDeniedException("Пользователь " + currentUser.getUserId() + " не имеет прав на редактирование чата " + chatId);
        }


        if (updateChatRequestDto.getName() != null && !updateChatRequestDto.getName().trim().isEmpty()) {
            chat.setName(updateChatRequestDto.getName().trim());
        }
        if (updateChatRequestDto.getDescription() != null) {
            chat.setDescription(updateChatRequestDto.getDescription().trim());
        }
        chat.setUpdatedAt(LocalDateTime.now());

        Chat updatedChat = chatRepository.save(chat);
        return convertToChatDto(updatedChat, currentUser.getUserId());
    }

    @Transactional
    public boolean deleteChat(Long workspaceId, Long chatId, User currentUser) {
        Chat chat = chatRepository.findByIdAndWorkspaceId(chatId, workspaceId).orElse(null);
        if (chat == null) {
            return false;
        }

        Workspace workspace = chat.getWorkspace();

        boolean isOwner = workspace.getOwner() != null &&
                currentUser != null &&
                workspace.getOwner().getUserId() != null &&
                currentUser.getUserId() != null &&
                workspace.getOwner().getUserId().equals(currentUser.getUserId());

        boolean isCreator = chat.getCreator() != null &&
                currentUser != null &&
                chat.getCreator().getUserId() != null &&
                currentUser.getUserId() != null &&
                chat.getCreator().getUserId().equals(currentUser.getUserId());

        boolean isMember = false;
        if (!isOwner && !isCreator) {
            WorkspaceMember member = memberRepository.findByWorkspaceAndUser(workspace, currentUser);
            isMember = member != null;
        }

        // Только владелец рабочего пространства или создатель чата может удалять чат
        if (!isOwner && !isCreator) {
            return false;
        }

        // Удаляем все сообщения чата (если нужно)
        chatMessageRepository.deleteAll(chatMessageRepository.findByChatId(chatId));

        // Удаляем сам чат
        chatRepository.delete(chat);

        return true;
    }

    private ChatMessageDto convertToChatMessageDto(ChatMessage message) {
        Hibernate.initialize(message.getReadByUsersIds());

        return ChatMessageDto.builder()
                .id(message.getId())
                .chatId(message.getChat().getId())
                .senderId(message.getSender().getUserId())
                .senderName(message.getSender().getFullName() != null ? message.getSender().getFullName()
                        : message.getSender().getEmail())
                .content(message.getContent())
                .sentAt(message.getSentAt())
                .editedAt(message.getEditedAt())
                .readByUsersIds(message.getReadByUsersIds())
                .build();
    }

    private ChatDto convertToChatDto(Chat chat, Long currentUserId) {
        ChatMessageDto lastMessageDto = null;
        List<Long> lastMessageReadByUsersIds = null;

        Page<ChatMessage> lastMessagesPage = chatMessageRepository.findByChatIdOrderBySentAtDesc(chat.getId(),
                Pageable.ofSize(1));
        if (lastMessagesPage.hasContent()) {
            ChatMessage lastMessageEntity = lastMessagesPage.getContent().get(0);
            lastMessageDto = convertToChatMessageDto(lastMessageEntity);
            lastMessageReadByUsersIds = lastMessageEntity.getReadByUsersIds();
        }

        return ChatDto.builder()
                .id(chat.getId())
                .name(chat.getName())
                .workspaceId(chat.getWorkspace().getId())
                .creatorId(chat.getCreator().getUserId())
                .creatorName(chat.getCreator().getFullName() != null ? chat.getCreator().getFullName()
                        : chat.getCreator().getEmail())
                .createdAt(chat.getCreatedAt())
                .updatedAt(chat.getUpdatedAt())
                .lastMessage(lastMessageDto)
                .lastMessageReadByUsersIds(lastMessageReadByUsersIds)
                .build();
    }
}