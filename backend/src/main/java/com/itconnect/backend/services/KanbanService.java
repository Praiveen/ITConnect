package com.itconnect.backend.services;

import com.itconnect.backend.dto.KanbanDto;
import com.itconnect.backend.entities.Kanban;
import com.itconnect.backend.entities.User;
import com.itconnect.backend.entities.Workspace;
import com.itconnect.backend.entities.WorkspaceRole;
import com.itconnect.backend.entities.WorkspaceMember;
import com.itconnect.backend.repositories.KanbanRepository;
import com.itconnect.backend.repositories.WorkspaceRepository;
import com.itconnect.backend.repositories.WorkspaceMemberRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class KanbanService {

    private final KanbanRepository kanbanRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository memberRepository;

    public KanbanService(
            KanbanRepository kanbanRepository,
            WorkspaceRepository workspaceRepository,
            WorkspaceMemberRepository memberRepository) {
        this.kanbanRepository = kanbanRepository;
        this.workspaceRepository = workspaceRepository;
        this.memberRepository = memberRepository;
    }

    /**
     * Получить все канбан-доски в рабочих областях пользователя
     */
    public List<KanbanDto> getAllBoardsByUser(User user) {

        List<Kanban> boards = kanbanRepository.findByWorkspaceOwnerOrWorkspaceMembersUser(user, user);
        return boards.stream()
                .map(board -> convertToDto(board, user))
                .collect(Collectors.toList());
    }

    /**
     * Получить все канбан-доски в конкретной рабочей области
     */
    public List<KanbanDto> getAllBoardsByWorkspace(Long workspaceId, User user) {
        Workspace workspace = workspaceRepository.findById(workspaceId).orElse(null);
        if (workspace == null) {
            return new ArrayList<>();
        }

        boolean isOwner = workspace.getOwner() != null &&
                user != null &&
                workspace.getOwner().getUserId() != null &&
                user.getUserId() != null &&
                workspace.getOwner().getUserId().equals(user.getUserId());

        if (!isOwner) {
            WorkspaceMember member = memberRepository.findByWorkspaceAndUser(workspace, user);
            if (member == null) {
                return new ArrayList<>();
            }
        }

        List<Kanban> boards = kanbanRepository.findByWorkspace(workspace);
        return boards.stream()
                .map(board -> convertToDto(board, user))
                .collect(Collectors.toList());
    }

    /**
     * Получить канбан-доску по id
     */
    public KanbanDto getBoardById(Long boardId, User user) {
        Kanban kanban = kanbanRepository.findById(boardId).orElse(null);
        if (kanban == null) {
            return null;
        }

        Workspace workspace = kanban.getWorkspace();

        boolean isOwner = workspace.getOwner() != null &&
                user != null &&
                workspace.getOwner().getUserId() != null &&
                user.getUserId() != null &&
                workspace.getOwner().getUserId().equals(user.getUserId());

        if (!isOwner) {
            WorkspaceMember member = memberRepository.findByWorkspaceAndUser(workspace, user);
            if (member == null) {
                return null;
            }
        }

        return convertToDto(kanban, user);
    }

    /**
     * Создать новую канбан-доску в рабочей области
     */
    @Transactional
    public KanbanDto createBoard(String name, String boardData, Long workspaceId, User user) {
        Workspace workspace = workspaceRepository.findById(workspaceId).orElse(null);
        if (workspace == null) {
            return null;
        }

        boolean isOwner = workspace.getOwner() != null &&
                user != null &&
                workspace.getOwner().getUserId() != null &&
                user.getUserId() != null &&
                workspace.getOwner().getUserId().equals(user.getUserId());

        if (!isOwner) {
            WorkspaceMember member = memberRepository.findByWorkspaceAndUser(workspace, user);
            if (member == null || member.getRole() != WorkspaceRole.ADMIN) {
                return null;
            }
        }

        Kanban kanban = new Kanban();
        kanban.setName(name);
        kanban.setBoardData(boardData != null ? boardData : "{}");
        kanban.setWorkspace(workspace);
        kanban.setCreatedById(user.getUserId());

        kanban = kanbanRepository.save(kanban);
        return convertToDto(kanban, user);
    }

    /**
     * Обновить существующую канбан-доску
     */
    @Transactional
    public KanbanDto updateBoard(Long boardId, String name, String boardData, User user) {
        try {
            Kanban kanban = kanbanRepository.findById(boardId).orElse(null);
            if (kanban == null) {
                System.err.println("Kanban доска не найдена, boardId: " + boardId);
                return null;
            }

            Workspace workspace = kanban.getWorkspace();
            if (workspace == null) {
                System.err.println("Рабочее пространство не найдено для доски: " + boardId);
                return null;
            }

            boolean isOwner = workspace.getOwner() != null &&
                    user != null &&
                    workspace.getOwner().getUserId() != null &&
                    user.getUserId() != null &&
                    workspace.getOwner().getUserId().equals(user.getUserId());

            WorkspaceRole role = null;

            if (!isOwner) {

                WorkspaceMember member = memberRepository.findByWorkspaceAndUser(workspace, user);
                if (member != null) {
                    role = member.getRole();
                } else {
                    return null;
                }
            } else {
            }

            if (!isOwner
                    && !(role != null && (role.equals(WorkspaceRole.ADMIN) || role.equals(WorkspaceRole.MEMBER)))) {
                System.err.println("Недостаточно прав для редактирования доски");
                return null;
            }

            kanban.setName(name);
            kanban.setBoardData(boardData);
            kanban = kanbanRepository.save(kanban);

            return convertToDto(kanban, user);
        } catch (Exception e) {
            System.err.println("Ошибка при обновлении доски: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }

    /**
     * Удалить канбан-доску
     */
    @Transactional
    public boolean deleteBoard(Long boardId, User user) {
        Kanban kanban = kanbanRepository.findById(boardId).orElse(null);
        if (kanban == null) {
            return false;
        }

        Workspace workspace = kanban.getWorkspace();
        boolean isOwner = workspace.getOwner() != null &&
                user != null &&
                workspace.getOwner().getUserId() != null &&
                user.getUserId() != null &&
                workspace.getOwner().getUserId().equals(user.getUserId());

        if (!isOwner) {

            WorkspaceMember member = memberRepository.findByWorkspaceAndUser(workspace, user);
            if (member == null || member.getRole() != WorkspaceRole.ADMIN) {
                return false;
            }
        }

        kanbanRepository.delete(kanban);
        return true;
    }

    /**
     * Конвертировать сущность в DTO
     */
    private KanbanDto convertToDto(Kanban kanban, User currentUser) {
        KanbanDto dto = new KanbanDto();
        dto.setId(kanban.getId());
        dto.setName(kanban.getName());
        dto.setBoardData(kanban.getBoardData());
        dto.setWorkspaceId(kanban.getWorkspace().getId());
        dto.setWorkspaceName(kanban.getWorkspace().getName());
        dto.setCreatedById(kanban.getCreatedById());
        dto.setCreatedAt(kanban.getCreatedAt());
        dto.setUpdatedAt(kanban.getUpdatedAt());

        Workspace workspace = kanban.getWorkspace();

        try {
            boolean isOwner = workspace.getOwner() != null &&
                    currentUser != null &&
                    workspace.getOwner().getUserId() != null &&
                    currentUser.getUserId() != null &&
                    workspace.getOwner().getUserId().equals(currentUser.getUserId());

            WorkspaceRole role = null;

            if (!isOwner) {

                WorkspaceMember member = memberRepository.findByWorkspaceAndUser(workspace, currentUser);
                if (member != null) {
                    role = member.getRole();
                }
            }

            boolean canEdit = isOwner ||
                    (role != null && (role.equals(WorkspaceRole.ADMIN) || role.equals(WorkspaceRole.MEMBER)));
            dto.setCanEdit(canEdit);
        } catch (Exception e) {

            dto.setCanEdit(false);
            System.err.println("Ошибка в convertToDto: " + e.getMessage());
            e.printStackTrace();
        }

        return dto;
    }
}