package com.vollmoon.rackwise.repo;

import com.vollmoon.rackwise.domain.Dispatch;
import com.vollmoon.rackwise.domain.DispatchStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface DispatchRepo extends JpaRepository<Dispatch, Long> {
    @Query("select d from Dispatch d join fetch d.material where d.warehouse.id = :warehouseId order by d.createdAt desc")
    List<Dispatch> findForWarehouse(Long warehouseId);

    @Query("select d from Dispatch d join fetch d.material join fetch d.warehouse where d.id = :id and d.organization.id = :orgId")
    Optional<Dispatch> findForOrg(Long id, Long orgId);

    long countByOrganizationId(Long orgId);

    long countByWarehouseIdAndStatus(Long warehouseId, DispatchStatus status);
}
