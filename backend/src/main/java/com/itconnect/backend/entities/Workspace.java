package com.itconnect.backend.entities;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.Accessors;
import jakarta.persistence.*;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.util.Date;
import java.util.HashSet;
import java.util.Set;

@NoArgsConstructor
@Data
@Accessors(chain = true)
@Entity
@Table(name = "workspaces")
public class Workspace {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String name;
    
    @Column(length = 1000)
    private String description;
    
    @ManyToOne
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;
    
    @OneToMany(mappedBy = "workspace", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<Kanban> boards = new HashSet<>();
    
    @OneToMany(mappedBy = "workspace", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<WorkspaceMember> members = new HashSet<>();
    
    @CreationTimestamp
    @Column(updatable = false, name = "created_at")
    private Date createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private Date updatedAt;
    
    public void addMember(User user, WorkspaceRole role) {
        WorkspaceMember member = new WorkspaceMember();
        member.setUser(user);
        member.setWorkspace(this);
        member.setRole(role);
        members.add(member);
    }
    
    public void removeMember(User user) {
        members.removeIf(member -> member.getUser().equals(user));
    }
    
    /**
     * Проверяет, является ли пользователь членом рабочей области
     * @deprecated Использует прямой доступ к коллекции members, что может вызвать LazyInitializationException.
     * Вместо этого используйте WorkspaceMemberRepository.findByWorkspaceAndUser(workspace, user)
     */
    @Deprecated
    public boolean hasMember(User user) {
        if (user == null || user.getUserId() == null) {
            return false;
        }
        
        for (WorkspaceMember member : members) {
            if (member.getUser() != null && 
                member.getUser().getUserId() != null && 
                member.getUser().getUserId().equals(user.getUserId())) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Получает роль пользователя в рабочей области
     * @deprecated Использует прямой доступ к коллекции members, что может вызвать LazyInitializationException.
     * Вместо этого используйте WorkspaceMemberRepository.findByWorkspaceAndUser(workspace, user)
     */
    @Deprecated
    public WorkspaceRole getMemberRole(User user) {
        return members.stream()
                .filter(member -> member.getUser().equals(user))
                .map(WorkspaceMember::getRole)
                .findFirst()
                .orElse(null);
    }
    
    /**
     * Безопасно получает роль пользователя в рабочей области
     * @deprecated Использует прямой доступ к коллекции members, что может вызвать LazyInitializationException.
     * Вместо этого используйте WorkspaceMemberRepository.findByWorkspaceAndUser(workspace, user)
     */
    @Deprecated
    public WorkspaceRole getMemberRoleSafe(User user) {
        if (user == null || user.getUserId() == null) {
            return null;
        }
        
        for (WorkspaceMember member : members) {
            if (member.getUser() != null && 
                member.getUser().getUserId() != null && 
                member.getUser().getUserId().equals(user.getUserId())) {
                return member.getRole();
            }
        }
        
        return null;
    }
} 