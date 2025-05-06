package com.itconnect.backend.repositories;

import com.itconnect.backend.entities.Kanban;
import com.itconnect.backend.entities.User;
import com.itconnect.backend.entities.Workspace;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface KanbanRepository extends CrudRepository<Kanban, Long> {
    
    /**
     * Найти все доски в определенной рабочей области
     */
    List<Kanban> findByWorkspace(Workspace workspace);
    
    /**
     * Найти все доски пользователя через связанные рабочие области
     * Включает доски из рабочих областей, где пользователь является владельцем или участником
     */
    @Query("SELECT k FROM Kanban k WHERE k.workspace.owner = ?1 OR EXISTS (SELECT 1 FROM WorkspaceMember wm WHERE wm.workspace = k.workspace AND wm.user = ?2)")
    List<Kanban> findByWorkspaceOwnerOrWorkspaceMembersUser(User owner, User member);
    
    /**
     * Найти доску по ID и проверить право доступа пользователя к ней
     */
    @Query("SELECT k FROM Kanban k WHERE k.id = ?1 AND (k.workspace.owner = ?2 OR EXISTS (SELECT 1 FROM WorkspaceMember wm WHERE wm.workspace = k.workspace AND wm.user = ?2))")
    Kanban findByIdAndAccessibleByUser(Long id, User user);
} 