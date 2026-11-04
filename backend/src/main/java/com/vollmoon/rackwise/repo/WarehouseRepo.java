package com.vollmoon.rackwise.repo;

import com.vollmoon.rackwise.domain.Warehouse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WarehouseRepo extends JpaRepository<Warehouse, Long> {
    List<Warehouse> findByOrganizationIdOrderByCodeAsc(Long orgId);

    Optional<Warehouse> findByIdAndOrganizationId(Long id, Long orgId);

    boolean existsByOrganizationIdAndCodeIgnoreCase(Long orgId, String code);

    long countByOrganizationId(Long orgId);
}
