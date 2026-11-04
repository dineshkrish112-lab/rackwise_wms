package com.vollmoon.rackwise.repo;

import com.vollmoon.rackwise.domain.StockTxn;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;

public interface StockTxnRepo extends JpaRepository<StockTxn, Long> {
    @Query("select t from StockTxn t join fetch t.material join fetch t.warehouse where t.organization.id = :orgId and t.createdAt between :from and :to order by t.createdAt desc")
    List<StockTxn> findForOrg(Long orgId, LocalDateTime from, LocalDateTime to);

    @Query("select t from StockTxn t join fetch t.material join fetch t.warehouse where t.warehouse.id = :warehouseId and t.createdAt between :from and :to order by t.createdAt desc")
    List<StockTxn> findForWarehouse(Long warehouseId, LocalDateTime from, LocalDateTime to);

    @Query("select t from StockTxn t join fetch t.material join fetch t.warehouse where t.warehouse.id = :warehouseId order by t.createdAt desc, t.id desc")
    List<StockTxn> recent(Long warehouseId, Pageable page);
}
