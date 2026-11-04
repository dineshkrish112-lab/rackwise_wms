package com.vollmoon.rackwise.repo;

import com.vollmoon.rackwise.domain.StockBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface StockBatchRepo extends JpaRepository<StockBatch, Long> {
    @Query("select s from StockBatch s join fetch s.bin b join fetch b.rack join fetch s.material where s.warehouse.id = :warehouseId")
    List<StockBatch> findForWarehouse(Long warehouseId);

    @Query("select s from StockBatch s join fetch s.bin b join fetch b.rack join fetch s.material join fetch s.warehouse where s.organization.id = :orgId")
    List<StockBatch> findForOrg(Long orgId);

    @Query("select s from StockBatch s join fetch s.bin join fetch s.material where s.bin.id = :binId order by s.receivedAt")
    List<StockBatch> findForBin(Long binId);

    /** FIFO order: oldest receipt first. */
    @Query("select s from StockBatch s join fetch s.bin b join fetch b.rack where s.warehouse.id = :warehouseId and s.material.id = :materialId and s.qtyKg > 0 order by s.receivedAt asc, s.id asc")
    List<StockBatch> findFifo(Long warehouseId, Long materialId);

    @Query("select s from StockBatch s join fetch s.bin b join fetch b.rack join fetch s.material join fetch s.warehouse where s.id = :id and s.organization.id = :orgId")
    Optional<StockBatch> findForOrg(Long id, Long orgId);

    @Query("select coalesce(sum(s.qtyKg),0) from StockBatch s where s.warehouse.id = :warehouseId and s.material.id = :materialId")
    double sumQty(Long warehouseId, Long materialId);

    @Query("select s.warehouse.id, sum(s.qtyKg) from StockBatch s where s.organization.id = :orgId group by s.warehouse.id")
    List<Object[]> stockByWarehouse(Long orgId);

    boolean existsByBinRackId(Long rackId);

    boolean existsByWarehouseId(Long warehouseId);

    boolean existsByMaterialId(Long materialId);
}
