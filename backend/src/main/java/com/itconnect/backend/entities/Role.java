package com.itconnect.backend.entities;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Objects;

import jakarta.persistence.*;

@Entity
@Table(name = "roles")
@Data
@NoArgsConstructor
public class Role {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String name;

    @Column
    private String description;

    public static final String USER = "USER";
    public static final String DIRECTOR = "DIRECTOR";
    public static final String DEPARTMENT_MANAGER = "DEPARTMENT_MANAGER";
    public static final String SUBDEPARTMENT_MANAGER = "SUBDEPARTMENT_MANAGER";
    public static final String EMPLOYEE = "EMPLOYEE";
    public static final String FULL_ACCESS = "FULL_ACCESS";


    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Role role = (Role) o;
        return Objects.equals(name, role.name);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name);
    }
} 