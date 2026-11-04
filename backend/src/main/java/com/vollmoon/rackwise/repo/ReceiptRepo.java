package com.vollmoon.rackwise.repo;

import com.vollmoon.rackwise.domain.Receipt;
import com.vollmoon.rackwise.domain.ReceiptStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ReceiptRepo extends JpaRepository<Receipt, Long> {
    @Query("select r from Receipt r join fetch r.material where r.warehouse.id = :warehouseId order by r.createdAt desc")
    List<Receipt> findForWarehouse(Long warehouseId);

    @Query("select r from Receipt r join fetch r.material join fetch r.warehouse where r.id = :id and r.organization.id = :orgId")
    Optional<Receipt> findForOrg(Long id, Long orgId);

    long countByOrganizationId(Long orgId);

    long countByWarehouseIdAndStatus(Long warehouseId, ReceiptStatus status);
}
