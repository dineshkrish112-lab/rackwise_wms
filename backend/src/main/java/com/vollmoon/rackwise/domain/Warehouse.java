package com.vollmoon.rackwise.domain;

import com.vollmoon.rackwise.common.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "warehouses", uniqueConstraints = @UniqueConstraint(columnNames = {"organization_id", "code"}))
@Getter
@Setter
public class Warehouse extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id")
    private Organization organization;
    @Column(nullable = false, length = 20)
    private String code;
    @Column(nullable = false, length = 120)
    private String name;
    private String location;
    /** Floor size in metres; the 3D floor is centred on (0,0). */
    private double widthM = 68;
    private double depthM = 46;
    /** Inward dock position, used to find the nearest free bin. */
    private double dockX = 23;
    private double dockZ = -21;
    private boolean active = true;
}
