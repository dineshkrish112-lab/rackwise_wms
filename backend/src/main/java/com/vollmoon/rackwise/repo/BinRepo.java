package com.vollmoon.rackwise.repo;

import com.vollmoon.rackwise.domain.Bin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface BinRepo extends JpaRepository<Bin, Long> {
    @Query("select b from Bin b join fetch b.rack where b.warehouse.id = :warehouseId")
    List<Bin> findForWarehouse(Long warehouseId);

    @Query("select b from Bin b join fetch b.rack where b.warehouse.id = :warehouseId and upper(b.code) = upper(:code)")
    Optional<Bin> findByCode(Long warehouseId, String code);

    @Query("select b.warehouse.id, sum(b.capacityKg) from Bin b where b.warehouse.organization.id = :orgId group by b.warehouse.id")
    List<Object[]> capacityByWarehouse(Long orgId);
}
