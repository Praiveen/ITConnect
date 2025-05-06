package com.itconnect.backend.services;

import com.itconnect.backend.entities.Notification;
import com.itconnect.backend.entities.User;
import com.itconnect.backend.entities.Workspace;
import com.itconnect.backend.repositories.NotificationRepository;
import com.itconnect.backend.repositories.UserRepository;
import com.itconnect.backend.repositories.WorkspaceRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class NotificationService {
    
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    
    @Autowired
    public NotificationService(
            NotificationRepository notificationRepository,
            UserRepository userRepository,
            WorkspaceRepository workspaceRepository) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.workspaceRepository = workspaceRepository;
    }
    
    /**
     * Создать новое уведомление
     */
    @Transactional
    public Notification createNotification(
            String message, 
            String type, 
            User sender, 
            User receiver, 
            String referenceType, 
            Long referenceId) {
        
        Notification notification = new Notification();
        notification.setMessage(message);
        notification.setType(type);
        notification.setSender(sender);
        notification.setReceiver(receiver);
        notification.setReferenceType(referenceType);
        notification.setReferenceId(referenceId);
        notification.setRead(false);
        notification.setCompleted(false);
        notification.setCreatedAt(LocalDateTime.now());
        
        return notificationRepository.save(notification);
    }
    
    /**
     * Создать приглашение в рабочее пространство
     */
    @Transactional
    public Notification createWorkspaceInvitation(
            String message,
            User sender,
            User receiver,
            Workspace workspace,
            String role) {
        
        Notification notification = new Notification();
        notification.setMessage(message);
        notification.setType(Notification.TYPE_WORKSPACE_INVITATION);
        notification.setSender(sender);
        notification.setReceiver(receiver);
        notification.setReferenceType(Notification.REF_TYPE_WORKSPACE);
        notification.setReferenceId(workspace.getId());
        notification.setWorkspace(workspace);
        notification.setRole(role);
        notification.setRead(false);
        notification.setCompleted(false);
        
        return notificationRepository.save(notification);
    }
    
    /**
     * Получить все непрочитанные уведомления для пользователя
     */
    @Transactional(readOnly = true)
    public List<Notification> getUnreadNotifications(User user) {
        return notificationRepository.findByReceiverAndIsReadFalseOrderByCreatedAtDesc(user);
    }
    
    /**
     * Получить количество непрочитанных уведомлений для пользователя
     */
    @Transactional(readOnly = true)
    public long getUnreadCount(User user) {
        return notificationRepository.countByReceiverAndIsReadFalse(user);
    }
    
    /**
     * Получить все уведомления для пользователя
     */
    @Transactional(readOnly = true)
    public List<Notification> getAllNotifications(User user) {
        return notificationRepository.findByReceiverOrderByCreatedAtDesc(user);
    }
    
    /**
     * Получить активные приглашения в рабочие пространства
     */
    @Transactional(readOnly = true)
    public List<Notification> getActiveWorkspaceInvitations(User user) {
        List<Notification> invitations = notificationRepository.findByReceiverAndTypeAndIsCompletedFalseOrderByCreatedAtDesc(
            user, Notification.TYPE_WORKSPACE_INVITATION);
        
        // Фильтруем только активные (не истекшие) приглашения
        return invitations.stream()
            .filter(invitation -> !invitation.isExpired())
            .collect(Collectors.toList());
    }
    
    /**
     * Получить приглашение по ID
     */
    public Optional<Notification> getNotificationById(Long id) {
        return notificationRepository.findById(id);
    }
    
    /**
     * Получить приглашение по токену
     */
    public Optional<Notification> getInvitationByToken(String token) {
        return notificationRepository.findByToken(token);
    }
    
    /**
     * Принять приглашение в рабочее пространство
     */
    @Transactional
    public boolean acceptWorkspaceInvitation(Long invitationId, User user) {
        Optional<Notification> optionalInvitation = notificationRepository.findById(invitationId);
        
        if (optionalInvitation.isEmpty() || 
            !optionalInvitation.get().getReceiver().equals(user) ||
            !Notification.TYPE_WORKSPACE_INVITATION.equals(optionalInvitation.get().getType()) ||
            optionalInvitation.get().isCompleted()) {
            return false;
        }
        
        Notification invitation = optionalInvitation.get();
        
        // Проверяем, не истекло ли приглашение
        if (invitation.isExpired()) {
            invitation.setCompleted(true);
            notificationRepository.save(invitation);
            return false;
        }
        
        // Отмечаем приглашение как завершенное
        invitation.setRead(true);
        invitation.setCompleted(true);
        notificationRepository.save(invitation);
        
        // Здесь нужно добавить пользователя в рабочее пространство (должно быть реализовано в WorkspaceService)
        // workspaceService.addMemberByInvitation(invitation.getWorkspace().getId(), user.getId(), invitation.getRole());
        
        return true;
    }
    
    /**
     * Отклонить приглашение в рабочее пространство
     */
    @Transactional
    public boolean declineWorkspaceInvitation(Long invitationId, User user) {
        Optional<Notification> optionalInvitation = notificationRepository.findById(invitationId);
        
        if (optionalInvitation.isEmpty() || 
            !optionalInvitation.get().getReceiver().equals(user) ||
            !Notification.TYPE_WORKSPACE_INVITATION.equals(optionalInvitation.get().getType()) ||
            optionalInvitation.get().isCompleted()) {
            return false;
        }
        
        Notification invitation = optionalInvitation.get();
        
        // Отмечаем приглашение как завершенное
        invitation.setRead(true);
        invitation.setCompleted(true);
        notificationRepository.save(invitation);
        
        return true;
    }
    
    /**
     * Отметить уведомление как прочитанное
     */
    @Transactional
    public boolean markAsRead(Long id, User user) {
        Optional<Notification> notificationOpt = notificationRepository.findById(id);
        if (notificationOpt.isPresent()) {
            Notification notification = notificationOpt.get();
            // Проверяем, что уведомление принадлежит данному пользователю
            if (notification.getReceiver().getUserId().equals(user.getUserId())) {
                notification.setRead(true);
                notification.setUpdatedAt(LocalDateTime.now());
                notificationRepository.save(notification);
                return true;
            }
        }
        return false;
    }
    
    /**
     * Отметить уведомление как выполненное
     */
    @Transactional
    public boolean markAsCompleted(Long id, User user) {
        Optional<Notification> notificationOpt = notificationRepository.findById(id);
        if (notificationOpt.isPresent()) {
            Notification notification = notificationOpt.get();
            // Проверяем, что уведомление принадлежит данному пользователю
            if (notification.getReceiver().getUserId().equals(user.getUserId())) {
                notification.setCompleted(true);
                notification.setUpdatedAt(LocalDateTime.now());
                notificationRepository.save(notification);
                return true;
            }
        }
        return false;
    }
    
    /**
     * Отметить все уведомления как прочитанные
     */
    @Transactional
    public void markAllAsRead(User user) {
        List<Notification> unreadNotifications = notificationRepository.findByReceiverAndIsReadFalseOrderByCreatedAtDesc(user);
        for (Notification notification : unreadNotifications) {
            notification.setRead(true);
            notification.setUpdatedAt(LocalDateTime.now());
        }
        notificationRepository.saveAll(unreadNotifications);
    }
    
    /**
     * Отметить все уведомления для определенной сущности как выполненные
     */
    @Transactional
    public void completeNotifications(String referenceType, Long referenceId, User user) {
        List<Notification> notifications = notificationRepository.findByReferenceTypeAndReferenceId(referenceType, referenceId);
        for (Notification notification : notifications) {
            if (notification.getReceiver().getUserId().equals(user.getUserId())) {
                notification.setCompleted(true);
                notification.setUpdatedAt(LocalDateTime.now());
            }
        }
        notificationRepository.saveAll(notifications);
    }
    
    /**
     * Удалить уведомление
     */
    @Transactional
    public boolean deleteNotification(Long id, User user) {
        Optional<Notification> notificationOpt = notificationRepository.findById(id);
        if (notificationOpt.isPresent()) {
            Notification notification = notificationOpt.get();
            // Проверяем, что уведомление принадлежит данному пользователю
            if (notification.getReceiver().getUserId().equals(user.getUserId())) {
                notificationRepository.delete(notification);
                return true;
            }
        }
        return false;
    }
} 