package com.itconnect.backend.services;

import com.itconnect.backend.entities.Role;
import com.itconnect.backend.entities.User;
import com.itconnect.backend.repositories.RoleRepository;
import com.itconnect.backend.repositories.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public class RoleService {

    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private UserRepository userRepository;

    public List<Role> findAll() {
        return roleRepository.findAll();
    }

    @Transactional
    public void changeUserRole(Long userId, String removeRole, String addRole) {
        try {
            User user = userRepository.findById(userId.intValue())
                .orElseThrow(() -> new RuntimeException("User not found"));
            
            if (addRole != null) {
                try {
                    Optional<Role> roleOptional = roleRepository.findByName(addRole);
                    
                    if (!roleOptional.isPresent()) {
                        roleRepository.findAll().forEach(role -> 
                            System.out.println("- " + role.getName()));
                        throw new RuntimeException("Role " + addRole + " not found");
                    }
                    
                    Role roleToAdd = roleOptional.get();
                    user.getRoles().add(roleToAdd);
                    userRepository.save(user);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }

            if (removeRole != null) {
                try {
                    Optional<Role> roleOptional = roleRepository.findByName(removeRole);
                    
                    Role roleToRemove = roleOptional
                        .orElseThrow(() -> new RuntimeException("Role " + removeRole + " not found"));
                    user.getRoles().remove(roleToRemove);
                    userRepository.save(user);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
            
            user = userRepository.findById(userId.intValue())
                .orElseThrow(() -> new RuntimeException("User not found"));
            
        } catch (Exception e) {
            e.printStackTrace();
            throw e;
        }
    }

    @Transactional
    public void addRoleToUser(Long userId, String roleName) {
        try {
            User user = userRepository.findById(userId.intValue())
                .orElseThrow(() -> new RuntimeException("User not found"));
            Role role = roleRepository.findByName(roleName)
                .orElseThrow(() -> new RuntimeException("Role not found"));
            
            user.getRoles().add(role);
            userRepository.save(user);
        } catch (Exception e) {
            e.printStackTrace();
            throw e;
        }
    }

    @Transactional
    public void removeRoleFromUser(Long userId, String roleName) {
        try {
            User user = userRepository.findById(userId.intValue())
                .orElseThrow(() -> new RuntimeException("User not found"));
            Role role = roleRepository.findByName(roleName)
                .orElseThrow(() -> new RuntimeException("Role not found"));
            
            user.getRoles().remove(role);
            userRepository.save(user);
        } catch (Exception e) {
            e.printStackTrace();
            throw e;
        }
    }
    

    public Set<Role> getUserRoles(Long userId) {
        User user = userRepository.findById(userId.intValue())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getRoles();
    }

    public boolean userHasRole(Long userId, String roleName) {
        User user = userRepository.findById(userId.intValue())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return user.hasRole(roleName);
    }

    public void checkRoleExists(String roleName) {
        Optional<Role> role = roleRepository.findByName(roleName);
        System.out.println("Role " + roleName + " exists: " + role.isPresent());
    }

}
