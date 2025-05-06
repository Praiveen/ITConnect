package com.itconnect.backend.repositories;

import com.itconnect.backend.entities.User;
import com.itconnect.backend.entities.Workspace;
import com.itconnect.backend.entities.WorkspaceMember;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkspaceMemberRepository extends CrudRepository<WorkspaceMember, Long> {
    List<WorkspaceMember> findByUser(User user);
    List<WorkspaceMember> findByWorkspace(Workspace workspace);
    WorkspaceMember findByWorkspaceAndUser(Workspace workspace, User user);
} 