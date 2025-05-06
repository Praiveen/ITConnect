package com.itconnect.backend.repositories;

import com.itconnect.backend.entities.User;
import com.itconnect.backend.entities.Workspace;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkspaceRepository extends CrudRepository<Workspace, Long> {
    List<Workspace> findByOwner(User owner);
} 