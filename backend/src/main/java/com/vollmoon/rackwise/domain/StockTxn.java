package com.vollmoon.rackwise.domain;

import com.vollmoon.rackwise.common.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Stock ledger: one row for every movement. Reports are built from this table. */
@Entity
@Table(name = "stock_txns", indexes = {@Index(columnList = "organization_id,createdAt"), @Index(columnList = "warehouse_id,createdAt")})
@Getter
@Setter
public class StockTxn extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id")
    private Organization organization;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "warehouse_id")
    private Warehouse warehouse;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 14)
    private TxnType type;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id")
    private Material material;
    private String binCode;
    private String batchNo;
    /** kg moved. Positive for IN, OUT and transfers; signed difference for ADJUST. */
    private double qtyKg;
    private String refNo;
    private String userName;
    private String remarks;
}
