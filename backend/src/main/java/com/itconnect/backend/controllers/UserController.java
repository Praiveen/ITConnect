package com.itconnect.backend.controllers;

import com.itconnect.backend.dto.ResponseDto;
import com.itconnect.backend.dto.UpdateProfileDto;
import com.itconnect.backend.entities.User;
import com.itconnect.backend.services.UserService;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RequestMapping("/user")
@RestController
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getUserProfile() {

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication != null && authentication.isAuthenticated() &&
                authentication.getPrincipal() instanceof UserDetails) {

            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            User user = (User) userDetails;

            Map<String, Object> userData = new HashMap<>();
            userData.put("id", user.getUserId());
            userData.put("firstName", user.getFirstName());
            userData.put("lastName", user.getLastName());
            userData.put("fullName", user.getFullName());
            userData.put("phoneNumber", user.getPhoneNumber());
            userData.put("email", user.getEmail());

            return ResponseEntity.ok(userData);
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ResponseDto("Пользователь не авторизован", false));
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(@RequestBody UpdateProfileDto profileDto) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication != null && authentication.isAuthenticated() &&
                authentication.getPrincipal() instanceof UserDetails) {

            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            User currentUser = (User) userDetails;
            try {
                currentUser.setFirstName(profileDto.getFirstName());
                currentUser.setLastName(profileDto.getLastName());
                currentUser.setFullName(
                        (profileDto.getFullName() != null && profileDto.getFullName() != "") ? profileDto.getFullName()
                                : profileDto.getFirstName() + " " + profileDto.getLastName());
                currentUser.setPhoneNumber(profileDto.getPhoneNumber());
                User updatedUser = userService.save(currentUser);
                Map<String, Object> userData = new HashMap<>();
                userData.put("id", updatedUser.getUserId());
                userData.put("firstName", updatedUser.getFirstName());
                userData.put("lastName", updatedUser.getLastName());
                userData.put("fullName", updatedUser.getFullName());
                userData.put("phoneNumber", updatedUser.getPhoneNumber());
                userData.put("email", updatedUser.getEmail());

                return ResponseEntity.ok(userData);
            } catch (Exception e) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(new ResponseDto("Ошибка при обновлении профиля: " + e.getMessage(), false));
            }
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ResponseDto("Пользователь не авторизован", false));
    }
}