package com.itconnect.backend.entities;

import lombok.Data;
import lombok.NoArgsConstructor;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.Date;
import java.util.Calendar;
import java.util.UUID;

@Data
@NoArgsConstructor
@Entity
@Table(name = "notifications")
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String message;

    @Column(nullable = false)
    private String type;

    @ManyToOne
    @JoinColumn(name = "sender_id")
    private User sender;

    @ManyToOne
    @JoinColumn(name = "receiver_id", nullable = false)
    private User receiver;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Column(nullable = false)
    private boolean isRead;

    @Column(nullable = false)
    private boolean isCompleted;

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(name = "reference_type")
    private String referenceType;

    @ManyToOne
    @JoinColumn(name = "workspace_id")
    private Workspace workspace;

    @Column(name = "role")
    private String role;

    @Column(name = "expires_at")
    private Date expiresAt;

    @Column(name = "token", unique = true)
    private String token;

    public static final String TYPE_WORKSPACE_INVITATION = "WORKSPACE_INVITATION";
    public static final String TYPE_TASK_ASSIGNED = "TASK_ASSIGNED";
    public static final String TYPE_COMMENT_ADDED = "COMMENT_ADDED";
    public static final String TYPE_BOARD_SHARED = "BOARD_SHARED";
    public static final String TYPE_MENTION = "MENTION";

    public static final String REF_TYPE_WORKSPACE = "WORKSPACE";
    public static final String REF_TYPE_KANBAN = "KANBAN";
    public static final String REF_TYPE_TASK = "TASK";

    public static final String ROLE_ADMIN = "ADMIN";
    public static final String ROLE_MEMBER = "MEMBER";
    public static final String ROLE_VIEWER = "VIEWER";

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
        if (!isRead) {
            isRead = false;
        }
        if (!isCompleted) {
            isCompleted = false;
        }

        if (TYPE_WORKSPACE_INVITATION.equals(type) && expiresAt == null) {

            Calendar calendar = Calendar.getInstance();
            calendar.setTime(new Date());
            calendar.add(Calendar.DAY_OF_MONTH, 7);
            expiresAt = calendar.getTime();

            if (token == null) {
                token = UUID.randomUUID().toString();
            }
        }
    }

    public boolean isExpired() {
        if (expiresAt == null) {
            return false;
        }
        return expiresAt.before(new Date());
    }
}
