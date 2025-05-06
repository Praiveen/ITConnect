package com.itconnect.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class UpdateProfileDto {
    private String firstName;
    private String lastName;
    private String fullName;
    private String phoneNumber;
    private String email;
} 