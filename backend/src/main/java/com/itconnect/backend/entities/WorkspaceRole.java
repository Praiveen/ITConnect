package com.itconnect.backend.entities;

/**
 * Перечисление ролей пользователей в рабочей области
 */
public enum WorkspaceRole {

    ADMIN("Администратор"),
    MEMBER("Участник"),
    VIEWER("Наблюдатель");
    
    private final String displayName;
    
    WorkspaceRole(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
} 