package com.itconnect.backend.repositories;

import com.itconnect.backend.entities.Notification;
import com.itconnect.backend.entities.User;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationRepository extends CrudRepository<Notification, Long> {

    List<Notification> findByReceiver(User receiver);

    List<Notification> findByReceiverOrderByCreatedAtDesc(User receiver);

    List<Notification> findByReceiverAndIsReadFalse(User receiver);

    List<Notification> findByReceiverAndIsReadFalseOrderByCreatedAtDesc(User receiver);

    long countByReceiverAndIsReadFalse(User receiver);

    List<Notification> findByReceiverAndTypeAndIsCompletedFalse(User receiver, String type);

    List<Notification> findByReceiverAndTypeAndIsCompletedFalseOrderByCreatedAtDesc(User receiver, String type);

    Optional<Notification> findByToken(String token);

    List<Notification> findByReferenceTypeAndReferenceId(String referenceType, Long referenceId);

    List<Notification> findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(String referenceType, Long referenceId);

    List<Notification> findByReferenceTypeAndReferenceIdAndReceiver(String referenceType, Long referenceId,
            User receiver);

    List<Notification> findByReferenceTypeAndReferenceIdAndReceiverAndIsCompletedFalse(String referenceType,
            Long referenceId, User receiver);
}