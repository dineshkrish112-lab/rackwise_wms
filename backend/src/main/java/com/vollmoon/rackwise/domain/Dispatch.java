package com.vollmoon.rackwise.domain;

import com.vollmoon.rackwise.common.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "dispatches")
@Getter
@Setter
public class Dispatch extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id")
    private Organization organization;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "warehouse_id")
    private Warehouse warehouse;
    @Column(nullable = false, length = 30)
    private String dspNo;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id")
    private Material material;
    private double qtyKg;
    private String destination;
    private String customerRef;
    private String remarks;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private DispatchStatus status = DispatchStatus.PENDING;
    private String createdByName;
    private LocalDateTime dispatchedAt;
}
