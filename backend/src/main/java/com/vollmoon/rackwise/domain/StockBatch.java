package com.vollmoon.rackwise.domain;

import com.vollmoon.rackwise.common.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** Quantity of one material, from one receipt batch, sitting in one bin. */
@Entity
@Table(name = "stock_batches", indexes = {@Index(columnList = "warehouse_id,material_id"), @Index(columnList = "bin_id")})
@Getter
@Setter
public class StockBatch extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id")
    private Organization organization;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "warehouse_id")
    private Warehouse warehouse;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bin_id")
    private Bin bin;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id")
    private Material material;
    @Column(nullable = false, length = 40)
    private String batchNo;
    private double qtyKg;
    /** Original receipt time; kept on transfers so FIFO stays correct. */
    @Column(nullable = false)
    private LocalDateTime receivedAt;
    private String refNo;
}
