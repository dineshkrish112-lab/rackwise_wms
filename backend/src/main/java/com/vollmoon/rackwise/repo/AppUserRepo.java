package com.vollmoon.rackwise.repo;

import com.vollmoon.rackwise.domain.AppUser;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AppUserRepo extends JpaRepository<AppUser, Long> {
    @EntityGraph(attributePaths = "organization")
    Optional<AppUser> findByEmailIgnoreCase(String email);

    @EntityGraph(attributePaths = "organization")
    Optional<AppUser> findWithOrgById(Long id);

    List<AppUser> findByOrganizationIdOrderByFullNameAsc(Long orgId);

    Optional<AppUser> findByIdAndOrganizationId(Long id, Long orgId);

    boolean existsByEmailIgnoreCase(String email);

    long countByOrganizationId(Long orgId);
}
