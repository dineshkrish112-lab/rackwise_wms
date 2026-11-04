package com.vollmoon.rackwise.repo;

import com.vollmoon.rackwise.domain.Material;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MaterialRepo extends JpaRepository<Material, Long> {
    List<Material> findByOrganizationIdOrderByNameAsc(Long orgId);

    Optional<Material> findByIdAndOrganizationId(Long id, Long orgId);

    boolean existsByOrganizationIdAndCodeIgnoreCase(Long orgId, String code);
}
