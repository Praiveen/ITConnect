package com.itconnect.backend.services;

import com.itconnect.backend.dto.WorkspaceDto;
import com.itconnect.backend.entities.*;
import com.itconnect.backend.repositories.WorkspaceMemberRepository;
import com.itconnect.backend.repositories.WorkspaceRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class WorkspaceService {
    
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository memberRepository;
    private final UserService userService;
    private final NotificationService notificationService;
    
    public WorkspaceService(
            WorkspaceRepository workspaceRepository,
            WorkspaceMemberRepository memberRepository,
            UserService userService,
            NotificationService notificationService) {
        this.workspaceRepository = workspaceRepository;
        this.memberRepository = memberRepository;
        this.userService = userService;
        this.notificationService = notificationService;
    }
    
    /**
     * Получить все рабочие области пользователя (включая те, где он участник)
     */
    public List<WorkspaceDto> getAllWorkspacesByUser(User user) {
        if (user == null || user.getUserId() == null) {
            return new ArrayList<>();
        }
        
        try {
            // Получаем рабочие области, где пользователь - владелец
            System.out.println("userId: " + user.getUserId());
            List<Workspace> ownedWorkspaces = workspaceRepository.findByOwner(user);
            System.out.println("Owned workspaces: " + ownedWorkspaces.size());
            
            // Получаем рабочие области, где пользователь - участник
            List<WorkspaceMember> memberships = memberRepository.findByUser(user);
            List<Workspace> memberWorkspaces = new ArrayList<>();
            
            // Безопасное получение workspaces из memberships
            for (WorkspaceMember membership : memberships) {
                if (membership != null && membership.getWorkspace() != null) {
                    memberWorkspaces.add(membership.getWorkspace());
                }
            }
            
            System.out.println("Member workspaces: " + memberWorkspaces.size());
            
            // Объединяем списки и добавляем их в новый список для устранения дубликатов
            List<Workspace> combinedList = new ArrayList<>();
            
            // Сначала добавляем все рабочие пространства, где пользователь владелец
            for (Workspace workspace : ownedWorkspaces) {
                System.out.println("Adding owned workspace: " + workspace.getId() + ", owner: " + 
                    (workspace.getOwner() != null ? workspace.getOwner().getUserId() : "null"));
                combinedList.add(workspace);
            }
            
            // Затем добавляем те, где пользователь участник, но не владелец
            for (Workspace workspace : memberWorkspaces) {
                boolean isOwned = false;
                for (Workspace owned : ownedWorkspaces) {
                    if (owned.getId().equals(workspace.getId())) {
                        isOwned = true;
                        break;
                    }
                }
                
                if (!isOwned) {
                    System.out.println("Adding member workspace: " + workspace.getId() + ", owner: " + 
                        (workspace.getOwner() != null ? workspace.getOwner().getUserId() : "null"));
                    combinedList.add(workspace);
                }
            }
            
            System.out.println("Combined workspaces: " + combinedList.size());
            
            // Конвертируем в DTO и добавляем информацию о роли пользователя
            List<WorkspaceDto> result = new ArrayList<>();
            
            for (Workspace workspace : combinedList) {
                try {
                    // Используем getWorkspaceById для получения полного DTO с участниками
                    WorkspaceDto dto = getWorkspaceById(workspace.getId(), user);
                    if (dto != null) {
                        result.add(dto);
                    }
                } catch (Exception e) {
                    System.err.println("Ошибка при обработке рабочего пространства id=" + workspace.getId() + ": " + e.getMessage());
                    e.printStackTrace();
                }
            }
            
            return result;
        } catch (Exception e) {
            System.err.println("Ошибка в getAllWorkspacesByUser: " + e.getMessage());
            e.printStackTrace();
            return new ArrayList<>();
        }
    }
    
    /**
     * Получить рабочую область по ID
     */
    @Transactional(readOnly = true)
    public WorkspaceDto getWorkspaceById(Long workspaceId, User user) {
        if (workspaceId == null || user == null) {
            return null;
        }
        
        try {
            // Получаем рабочее пространство
            Workspace workspace = workspaceRepository.findById(workspaceId).orElse(null);
            if (workspace == null) {
                return null;
            }
            
            // Проверяем доступ: пользователь должен быть либо владельцем, либо участником
            boolean isOwner = workspace.getOwner() != null && 
                             user.getUserId() != null && 
                             workspace.getOwner().getUserId() != null &&
                             workspace.getOwner().getUserId().equals(user.getUserId());
            
            // Используем отдельный запрос для проверки членства вместо доступа к коллекции
            WorkspaceMember member = memberRepository.findByWorkspaceAndUser(workspace, user);
            boolean isMember = member != null;
            
            if (!isOwner && !isMember) {
                return null;
            }
            
            // Создаем DTO
            WorkspaceDto dto = new WorkspaceDto();
            dto.setId(workspace.getId());
            dto.setName(workspace.getName());
            dto.setDescription(workspace.getDescription());
            
            if (workspace.getOwner() != null) {
                dto.setOwnerId(workspace.getOwner().getUserId());
                dto.setOwnerName(workspace.getOwner().getFullName() != null ? 
                                 workspace.getOwner().getFullName() : 
                                 workspace.getOwner().getUsername());
            }
            
            dto.setCreatedAt(workspace.getCreatedAt());
            dto.setUpdatedAt(workspace.getUpdatedAt());
            
            // Устанавливаем роль пользователя
            if (isOwner) {
                dto.setRole(WorkspaceRole.ADMIN.name());
                dto.setOwner(true);
            } else if (member != null) {
                dto.setRole(member.getRole() != null ? member.getRole().name() : null);
                dto.setOwner(false);
            } else {
                dto.setRole(null);
                dto.setOwner(false);
            }
            
            // Получаем список участников и их количество
            try {
                List<WorkspaceMember> members = memberRepository.findByWorkspace(workspace);
                dto.setMembersCount(members != null ? members.size() : 0);
                
                // Преобразуем список участников в формат для DTO
                if (members != null && !members.isEmpty()) {
                    List<Map<String, Object>> membersList = new ArrayList<>();
                    
                    for (WorkspaceMember wsm : members) {
                        if (wsm != null && wsm.getUser() != null) {
                            Map<String, Object> memberInfo = new HashMap<>();
                            User memberUser = wsm.getUser();
                            
                            memberInfo.put("id", memberUser.getUserId());
                            memberInfo.put("fullName", memberUser.getFullName() != null ? 
                                            memberUser.getFullName() : memberUser.getUsername());
                            memberInfo.put("email", memberUser.getEmail());
                            memberInfo.put("role", wsm.getRole() != null ? wsm.getRole().name() : null);
                            
                            // Проверяем, является ли участник владельцем
                            boolean memberIsOwner = workspace.getOwner() != null && 
                                               memberUser.getUserId() != null && 
                                               workspace.getOwner().getUserId() != null &&
                                               memberUser.getUserId().equals(workspace.getOwner().getUserId());
                            memberInfo.put("isOwner", memberIsOwner);
                            
                            membersList.add(memberInfo);
                        }
                    }
                    
                    // Добавляем владельца в список, если его там еще нет
                    boolean ownerInList = false;
                    for (Map<String, Object> memberInfo : membersList) {
                        if (workspace.getOwner() != null && 
                            memberInfo.get("id") != null && 
                            workspace.getOwner().getUserId() != null &&
                            memberInfo.get("id").equals(workspace.getOwner().getUserId())) {
                            ownerInList = true;
                            break;
                        }
                    }
                    
                    if (!ownerInList && workspace.getOwner() != null) {
                        Map<String, Object> ownerInfo = new HashMap<>();
                        User ownerUser = workspace.getOwner();
                        
                        ownerInfo.put("id", ownerUser.getUserId());
                        ownerInfo.put("fullName", ownerUser.getFullName() != null ? 
                                    ownerUser.getFullName() : ownerUser.getUsername());
                        ownerInfo.put("email", ownerUser.getEmail());
                        ownerInfo.put("role", WorkspaceRole.ADMIN.name());
                        ownerInfo.put("isOwner", true);
                        
                        membersList.add(ownerInfo);
                    }
                    
                    dto.setMembers(membersList);
                } else {
                    dto.setMembers(new ArrayList<>());
                }
            } catch (Exception e) {
                System.err.println("Ошибка при получении списка участников: " + e.getMessage());
                e.printStackTrace();
                dto.setMembersCount(0);
                dto.setMembers(new ArrayList<>());
            }
            
            return dto;
        } catch (Exception e) {
            System.err.println("Ошибка в getWorkspaceById: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }
    
    /**
     * Создать новую рабочую область
     */
    @Transactional
    public WorkspaceDto createWorkspace(String name, String description, User owner) {
        Workspace workspace = new Workspace();
        workspace.setName(name);
        workspace.setDescription(description);
        workspace.setOwner(owner);
        
        // Сохраняем рабочую область
        workspace = workspaceRepository.save(workspace);
        
        return convertToDto(workspace);
    }
    
    /**
     * Обновить рабочую область
     */
    @Transactional
    public WorkspaceDto updateWorkspace(Long workspaceId, String name, String description, User user) {
        try {
            Workspace workspace = workspaceRepository.findById(workspaceId).orElse(null);
            if (workspace == null || user == null || user.getUserId() == null) {
                return null;
            }
            
            // Только владелец может обновлять основную информацию о рабочей области
            boolean isOwner = workspace.getOwner() != null && 
                             workspace.getOwner().getUserId() != null && 
                             workspace.getOwner().getUserId().equals(user.getUserId());
            
            if (!isOwner) {
                return null;
            }
            
            if (name != null && !name.trim().isEmpty()) {
                workspace.setName(name);
            }
            
            if (description != null) {
                workspace.setDescription(description);
            }
            
            workspace = workspaceRepository.save(workspace);
            return convertToDto(workspace);
        } catch (Exception e) {
            System.err.println("Ошибка в updateWorkspace: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }
    
    /**
     * Удалить рабочую область
     */
    @Transactional
    public boolean deleteWorkspace(Long workspaceId, User user) {
        try {
            Workspace workspace = workspaceRepository.findById(workspaceId).orElse(null);
            if (workspace == null || user == null || user.getUserId() == null) {
                return false;
            }
            
            // Только владелец может удалить рабочую область
            boolean isOwner = workspace.getOwner() != null && 
                             workspace.getOwner().getUserId() != null && 
                             workspace.getOwner().getUserId().equals(user.getUserId());
            
            if (!isOwner) {
                return false;
            }
            
            workspaceRepository.delete(workspace);
            return true;
        } catch (Exception e) {
            System.err.println("Ошибка в deleteWorkspace: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }
    
    /**
     * Добавить пользователя в рабочую область
     */
    @Transactional
    public boolean addMember(Long workspaceId, Long userId, WorkspaceRole role, User currentUser) {
        try {
            Workspace workspace = workspaceRepository.findById(workspaceId).orElse(null);
            if (workspace == null) {
                return false;
            }
            
            // Проверяем, имеет ли текущий пользователь права на добавление участников
            boolean isOwner = workspace.getOwner() != null && 
                             currentUser != null && 
                             workspace.getOwner().getUserId() != null && 
                             currentUser.getUserId() != null &&
                             workspace.getOwner().getUserId().equals(currentUser.getUserId());
            
            WorkspaceRole currentUserRole = workspace.getMemberRoleSafe(currentUser);
            boolean isAdmin = WorkspaceRole.ADMIN.equals(currentUserRole);
            
            if (!isOwner && !isAdmin) {
                return false;
            }
            
            // Находим пользователя, которого нужно добавить
            User userToAdd = userService.findById(userId.intValue()).orElse(null);
            if (userToAdd == null) {
                return false;
            }
            
            // Проверяем, не является ли пользователь уже участником рабочей области - используем безопасный метод
            if (workspace.hasMember(userToAdd)) {
                // Обновляем роль, если пользователь уже существует
                WorkspaceMember member = memberRepository.findByWorkspaceAndUser(workspace, userToAdd);
                if (member != null) {
                    member.setRole(role);
                    memberRepository.save(member);
                }
                return true;
            }
            
            // Добавляем пользователя в рабочую область
            WorkspaceMember newMember = new WorkspaceMember();
            newMember.setWorkspace(workspace);
            newMember.setUser(userToAdd);
            newMember.setRole(role);
            memberRepository.save(newMember);
            
            return true;
        } catch (Exception e) {
            System.err.println("Ошибка в addMember: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }
    
    /**
     * Удалить пользователя из рабочей области
     */
    @Transactional
    public boolean removeMember(Long workspaceId, Long userId, User currentUser) {
        try {
            Workspace workspace = workspaceRepository.findById(workspaceId).orElse(null);
            if (workspace == null) {
                return false;
            }
            
            // Проверяем, имеет ли текущий пользователь права на удаление участников
            boolean isOwner = workspace.getOwner() != null && 
                             currentUser != null && 
                             workspace.getOwner().getUserId() != null && 
                             currentUser.getUserId() != null &&
                             workspace.getOwner().getUserId().equals(currentUser.getUserId());
            
            WorkspaceRole currentUserRole = workspace.getMemberRoleSafe(currentUser);
            boolean isAdmin = WorkspaceRole.ADMIN.equals(currentUserRole);
            
            if (!isOwner && !isAdmin) {
                return false;
            }
            
            // Находим пользователя, которого нужно удалить
            User userToRemove = userService.findById(userId.intValue()).orElse(null);
            if (userToRemove == null) {
                return false;
            }
            
            // Нельзя удалить владельца рабочей области
            boolean isUserToRemoveOwner = workspace.getOwner() != null && 
                                         userToRemove != null && 
                                         workspace.getOwner().getUserId() != null && 
                                         userToRemove.getUserId() != null &&
                                         workspace.getOwner().getUserId().equals(userToRemove.getUserId());
            
            if (isUserToRemoveOwner) {
                return false;
            }
            
            // Удаляем участника напрямую из репозитория, а не через коллекцию
            WorkspaceMember member = memberRepository.findByWorkspaceAndUser(workspace, userToRemove);
            if (member != null) {
                memberRepository.delete(member);
                return true;
            }
            
            return false;
        } catch (Exception e) {
            System.err.println("Ошибка в removeMember: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }
    
    /**
     * Пригласить пользователя в рабочую область
     */
    @Transactional
    public Notification inviteUser(Long workspaceId, String email, WorkspaceRole role, User inviter) {
        try {
            // Проверяем существование рабочей области
            Workspace workspace = workspaceRepository.findById(workspaceId).orElse(null);
            if (workspace == null || inviter == null || inviter.getUserId() == null) {
                return null;
            }
            
            // Проверяем, что текущий пользователь имеет права для приглашения
            boolean isOwner = workspace.getOwner() != null && 
                              workspace.getOwner().getUserId() != null && 
                              workspace.getOwner().getUserId().equals(inviter.getUserId());
            
            WorkspaceMember inviterMember = memberRepository.findByWorkspaceAndUser(workspace, inviter);
            WorkspaceRole inviterRole = inviterMember != null ? inviterMember.getRole() : null;
            
            boolean hasPermission = isOwner || 
                    (inviterRole != null && 
                     (inviterRole.equals(WorkspaceRole.ADMIN) || 
                     (inviterRole.equals(WorkspaceRole.MEMBER) && role.equals(WorkspaceRole.VIEWER))));
            
            if (!hasPermission) {
                return null;
            }
            
            // Ищем пользователя по email
            Optional<User> optionalInvitee = userService.findByEmail(email);
            if (optionalInvitee.isEmpty()) {
                return null;
            }
            
            User invitee = optionalInvitee.get();
            
            // Если пользователь уже в рабочей области, возвращаем null
            if (isUserInWorkspaceSafe(workspace, invitee)) {
                return null;
            }
            
            // Проверяем, есть ли уже активное приглашение для этого пользователя
            List<Notification> activeInvitations = notificationService.getActiveWorkspaceInvitations(invitee);
            for (Notification invitation : activeInvitations) {
                if (invitation.getWorkspace() != null && invitation.getWorkspace().getId().equals(workspaceId)) {
                    // Уже есть активное приглашение, возвращаем его
                    return invitation;
                }
            }
            
            // Создаем новое приглашение
            String inviterName = inviter.getFullName() != null ? inviter.getFullName() : inviter.getUsername();
            String message = String.format("%s приглашает вас присоединиться к рабочему пространству '%s' в роли %s", 
                    inviterName, workspace.getName(), role.name());
            
            return notificationService.createWorkspaceInvitation(
                    message,
                    inviter,
                    invitee,
                    workspace,
                    role.name()
            );
        } catch (Exception e) {
            System.err.println("Ошибка в inviteUser: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }
    
    /**
     * Принять приглашение в рабочую область
     */
    @Transactional
    public boolean acceptInvitation(Long invitationId, User user) {
        try {
            // Проверяем наличие приглашения и права доступа
            Optional<Notification> optionalInvitation = notificationService.getNotificationById(invitationId);
            if (optionalInvitation.isEmpty() || user == null || user.getUserId() == null) {
                return false;
            }
            
            Notification invitation = optionalInvitation.get();
            
            // Проверяем тип и получателя приглашения
            if (!Notification.TYPE_WORKSPACE_INVITATION.equals(invitation.getType()) ||
                invitation.getReceiver() == null ||
                invitation.getReceiver().getUserId() == null ||
                !invitation.getReceiver().getUserId().equals(user.getUserId()) ||
                invitation.isCompleted()) {
                return false;
            }
            
            // Проверяем, что приглашение не истекло
            if (invitation.isExpired()) {
                invitation.setCompleted(true);
                return false;
            }
            
            // Получаем рабочую область и роль
            Workspace workspace = invitation.getWorkspace();
            if (workspace == null) {
                return false;
            }
            
            String roleStr = invitation.getRole();
            WorkspaceRole role;
            try {
                role = WorkspaceRole.valueOf(roleStr);
            } catch (IllegalArgumentException e) {
                role = WorkspaceRole.VIEWER; // По умолчанию
            }
            
            // Проверяем, не является ли пользователь уже членом рабочей области
            if (isUserInWorkspaceSafe(workspace, user)) {
                invitation.setCompleted(true);
                return true;
            }
            
            // Добавляем пользователя в рабочую область
            WorkspaceMember member = new WorkspaceMember();
            member.setWorkspace(workspace);
            member.setUser(user);
            member.setRole(role);
            memberRepository.save(member);
            
            // Отмечаем приглашение как принятое
            notificationService.markAsCompleted(invitationId, user);
            
            return true;
        } catch (Exception e) {
            System.err.println("Ошибка в acceptInvitation: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }
    
    /**
     * Отклонить приглашение в рабочую область
     */
    @Transactional
    public boolean declineInvitation(Long invitationId, User user) {
        try {
            // Для отклонения приглашения просто отмечаем его как обработанное
            return notificationService.declineWorkspaceInvitation(invitationId, user);
        } catch (Exception e) {
            System.err.println("Ошибка в declineInvitation: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }
    
    /**
     * Получить активные приглашения пользователя
     */
    public List<Notification> getActiveInvitationsByUser(User user) {
        try {
            if (user == null || user.getUserId() == null) {
                System.err.println("getActiveInvitationsByUser: пользователь или ID пользователя равен null");
                return new ArrayList<>();
            }
            
            List<Notification> invitations = notificationService.getActiveWorkspaceInvitations(user);
            if (invitations == null) {
                return new ArrayList<>();
            }
            
            return invitations;
        } catch (Exception e) {
            System.err.println("Ошибка в getActiveInvitationsByUser: " + e.getMessage());
            e.printStackTrace();
            return new ArrayList<>();
        }
    }
    
    /**
     * Проверяет, является ли пользователь членом рабочей области
     */
    private boolean isUserInWorkspaceSafe(Workspace workspace, User user) {
        if (workspace == null || user == null || user.getUserId() == null) {
            return false;
        }
        
        try {
            // Проверяем, является ли пользователь владельцем
            boolean isOwner = workspace.getOwner() != null && 
                             workspace.getOwner().getUserId() != null && 
                             user.getUserId() != null &&
                             workspace.getOwner().getUserId().equals(user.getUserId());
            
            if (isOwner) {
                return true;
            }
            
            // Проверяем, является ли пользователь участником через прямой запрос к репозиторию
            // вместо перебора коллекции
            WorkspaceMember member = memberRepository.findByWorkspaceAndUser(workspace, user);
            return member != null;
        } catch (Exception e) {
            System.err.println("Ошибка в isUserInWorkspaceSafe: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }
    
    /**
     * Добавить пользователя в рабочую область по приглашению
     */
    @Transactional
    public boolean addMemberByInvitation(Long workspaceId, Long userId, String role) {
        try {
            Workspace workspace = workspaceRepository.findById(workspaceId).orElse(null);
            
            // Используем правильный метод для поиска пользователя по ID
            Optional<User> userOptional = userService.findByEmail(userId.toString());
            User user = userOptional.orElse(null);
            
            if (workspace == null || user == null) {
                return false;
            }
            
            // Проверяем, не является ли пользователь уже членом рабочей области
            if (isUserInWorkspaceSafe(workspace, user)) {
                return true;
            }
            
            // Конвертируем строку роли в enum
            WorkspaceRole workspaceRole;
            try {
                workspaceRole = WorkspaceRole.valueOf(role);
            } catch (IllegalArgumentException e) {
                workspaceRole = WorkspaceRole.VIEWER; // По умолчанию
            }
            
            // Добавляем пользователя в рабочую область
            WorkspaceMember member = new WorkspaceMember();
            member.setWorkspace(workspace);
            member.setUser(user);
            member.setRole(workspaceRole);
            memberRepository.save(member);
            
            return true;
        } catch (Exception e) {
            System.err.println("Ошибка в addMemberByInvitation: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }
    
    /**
     * Конвертировать сущность в базовый DTO (без списка участников)
     */
    private WorkspaceDto convertToDto(Workspace workspace) {
        if (workspace == null) {
            System.out.println("convertToDto: workspace is null");
            return null;
        }
        
        try {
            WorkspaceDto dto = new WorkspaceDto();
            dto.setId(workspace.getId());
            dto.setName(workspace.getName());
            dto.setDescription(workspace.getDescription());
            
            // Проверка на null для owner
            if (workspace.getOwner() != null) {
                dto.setOwnerId(workspace.getOwner().getUserId());
                dto.setOwnerName(workspace.getOwner().getFullName() != null ? 
                                workspace.getOwner().getFullName() : 
                                workspace.getOwner().getUsername());
            } else {
                System.out.println("convertToDto: owner is null");
            }
            
            dto.setCreatedAt(workspace.getCreatedAt());
            dto.setUpdatedAt(workspace.getUpdatedAt());
            
            // Безопасное получение количества участников через репозиторий
            // вместо прямого доступа к коллекции members
            try {
                List<WorkspaceMember> members = memberRepository.findByWorkspace(workspace);
                dto.setMembersCount(members != null ? members.size() : 0);
            } catch (Exception e) {
                System.out.println("Ошибка при получении списка участников: " + e.getMessage());
                dto.setMembersCount(0);
            }
            
            // Инициализируем пустой список участников
            dto.setMembers(new ArrayList<>());
            
            return dto;
        } catch (Exception e) {
            System.out.println("Ошибка в convertToDto: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }
    
    /**
     * Проверяет, является ли пользователь членом рабочей области
     * @deprecated Используйте {@link #isUserInWorkspaceSafe(Workspace, User)} вместо этого метода
     */
    @Deprecated
    private boolean isUserInWorkspace(Workspace workspace, User user) {
        return isUserInWorkspaceSafe(workspace, user);
    }
} 