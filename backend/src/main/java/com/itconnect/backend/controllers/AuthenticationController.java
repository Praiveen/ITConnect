package com.itconnect.backend.controllers;


import com.itconnect.backend.dto.LoginUserDto;
import com.itconnect.backend.dto.RegisterUserDto;
import com.itconnect.backend.dto.ResponseDto;
import com.itconnect.backend.entities.*;
import com.itconnect.backend.services.*;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RequestMapping("/auth")
@RestController
public class AuthenticationController {
    private final JwtService jwtService;
    private final AuthenticationService authenticationService;
    private final UserService userService;

    public AuthenticationController(JwtService jwtService, AuthenticationService authenticationService, UserService userService) {
        this.jwtService = jwtService;
        this.authenticationService = authenticationService;
        this.userService = userService;
    }

   
    @PostMapping("/signup")
    public ResponseEntity<?> register(@RequestBody RegisterUserDto registerUserDto) {
        if (!authenticationService.saveUser(registerUserDto)) {
            return ResponseEntity.badRequest()
                .body(new ResponseDto("Пользователь с такой почтой уже зарегистрирован", false));
        }
        
        User registeredUser = authenticationService.signup(registerUserDto);
        return ResponseEntity.ok(
            new ResponseDto("Аккаунт зарегистрирован, теперь можно в него войти!", true)
        );
    }

   
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> authenticate(@RequestBody LoginUserDto loginUserDto, HttpServletResponse response) {
        User authenticatedUser = authenticationService.authenticate(loginUserDto);
        String jwtToken = jwtService.generateToken(authenticatedUser);

        Cookie cookie = new Cookie("jwtToken", jwtToken);
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/");
        cookie.setMaxAge(60 * 60);
        response.addCookie(cookie);

        LoginResponse loginResponse = new LoginResponse().setToken(jwtToken).setExpiresIn(jwtService.getExpirationTime());
        return ResponseEntity.ok(loginResponse);
    }

   
    @GetMapping("/logout")
    public ResponseEntity<String> logout(HttpServletResponse response) {
        Cookie jwtCookie = new Cookie("jwtToken", null);
        jwtCookie.setHttpOnly(true);
        jwtCookie.setPath("/");
        jwtCookie.setMaxAge(0);
        response.addCookie(jwtCookie);
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create("/")).build();
    }
    
   
    @GetMapping("/check")
    public ResponseEntity<?> checkAuthStatus(HttpServletRequest request) {
        
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        
        
        if (authentication != null && authentication.isAuthenticated() && 
            authentication.getPrincipal() instanceof UserDetails) {
            
            
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            User user = (User) userDetails;
            
            
            Map<String, Object> response = new HashMap<>();
            response.put("isAuthenticated", true);
            
            Map<String, Object> userData = new HashMap<>();
            userData.put("id", user.getUserId());
            userData.put("name", user.getFirstName());
            userData.put("email", user.getEmail());
            
            response.put("user", userData);
            
            return ResponseEntity.ok(response);
        }
        
        
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(new ResponseDto("Пользователь не авторизован", false));
    }
}