package com.itconnect.backend.entities;

import lombok.Data;
import lombok.NoArgsConstructor;
import jakarta.persistence.*;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.util.Date;

@NoArgsConstructor
@Data
@Entity
@Table(name = "workspace_members", 
       uniqueConstraints = @UniqueConstraint(columnNames = {"workspace_id", "user_id"}))
public class WorkspaceMember {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne
    @JoinColumn(name = "workspace_id", nullable = false)
    private Workspace workspace;
    
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private WorkspaceRole role;
    
    @CreationTimestamp
    @Column(updatable = false, name = "joined_at")
    private Date joinedAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private Date updatedAt;
} 