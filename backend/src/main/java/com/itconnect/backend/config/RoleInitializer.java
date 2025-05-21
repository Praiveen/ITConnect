package com.itconnect.backend.config;

import com.itconnect.backend.entities.Role;
import com.itconnect.backend.repositories.RoleRepository;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RoleInitializer {
    
    private final RoleRepository roleRepository;
    
    @PostConstruct
    public void init() {
        createRoleIfNotExists(Role.USER, "Базовый пользователь системы");
        createRoleIfNotExists(Role.DIRECTOR, "Директор компании");
        createRoleIfNotExists(Role.DEPARTMENT_MANAGER, "Руководитель отдела");
        createRoleIfNotExists(Role.SUBDEPARTMENT_MANAGER, "Руководитель подотдела");
        createRoleIfNotExists(Role.EMPLOYEE, "Сотрудник компании");
        createRoleIfNotExists(Role.FULL_ACCESS, "Полный доступ к системе");
    }
    
    private void createRoleIfNotExists(String name, String description) {
        if (!roleRepository.findByName(name).isPresent()) {
            Role role = new Role();
            role.setName(name);
            role.setDescription(description);
            roleRepository.save(role);
        }
    }
    
} 