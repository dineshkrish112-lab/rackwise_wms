package com.vollmoon.rackwise.repo;

import com.vollmoon.rackwise.domain.Rack;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface RackRepo extends JpaRepository<Rack, Long> {
    @Query("select r from Rack r left join fetch r.preferredMaterial where r.warehouse.id = :warehouseId order by r.code")
    List<Rack> findForWarehouse(Long warehouseId);

    Optional<Rack> findByIdAndWarehouseId(Long id, Long warehouseId);

    boolean existsByWarehouseIdAndCodeIgnoreCase(Long warehouseId, String code);
}
