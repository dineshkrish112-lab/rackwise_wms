package com.vollmoon.rackwise.domain;

import com.vollmoon.rackwise.common.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** Goods receipt note (GRN): material arrived at the dock, waiting to be put away. */
@Entity
@Table(name = "receipts")
@Getter
@Setter
public class Receipt extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id")
    private Organization organization;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "warehouse_id")
    private Warehouse warehouse;
    @Column(nullable = false, length = 30)
    private String grnNo;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id")
    private Material material;
    private double qtyKg;
    private String supplier;
    private String invoiceNo;
    private String vehicleNo;
    private String remarks;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private ReceiptStatus status = ReceiptStatus.PENDING;
    private String createdByName;
    private LocalDateTime storedAt;
}
