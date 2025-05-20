package com.itconnect.backend.repositories;

import com.itconnect.backend.entities.Chat;
import com.itconnect.backend.entities.ChatMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    Page<ChatMessage> findByChatIdOrderBySentAtAsc(Long chatId, Pageable pageable);
    Page<ChatMessage> findByChatIdOrderBySentAtDesc(Long chatId, Pageable pageable);
    List<ChatMessage> findByChatIdOrderBySentAtAsc(Long chatId);
    Page<ChatMessage> findByChatOrderBySentAtDesc(Chat chat, Pageable pageable);
} 