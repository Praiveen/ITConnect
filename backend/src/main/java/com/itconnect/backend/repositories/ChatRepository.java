package com.itconnect.backend.repositories;

import com.itconnect.backend.entities.Chat;
import com.itconnect.backend.entities.Workspace;
import com.itconnect.backend.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatRepository extends JpaRepository<Chat, Long> {
    List<Chat> findByWorkspaceId(Long workspaceId);
    Optional<Chat> findByIdAndWorkspaceId(Long id, Long workspaceId);
    List<Chat> findByWorkspace(Workspace workspace);

    /**
     * Найти все чаты пользователя через связанные рабочие области.
     * Включает чаты из рабочих областей, где пользователь является владельцем или участником.
     */
    @Query("SELECT c FROM Chat c WHERE c.workspace.owner = :user OR EXISTS (SELECT 1 FROM WorkspaceMember wm WHERE wm.workspace = c.workspace AND wm.user = :user)")
    List<Chat> findAllByUserAccess(@Param("user") User user);
} 