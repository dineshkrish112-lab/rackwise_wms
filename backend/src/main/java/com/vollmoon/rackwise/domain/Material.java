package com.vollmoon.rackwise.domain;

import com.vollmoon.rackwise.common.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "materials", uniqueConstraints = @UniqueConstraint(columnNames = {"organization_id", "code"}))
@Getter
@Setter
public class Material extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id")
    private Organization organization;
    @Column(nullable = false, length = 40)
    private String code;
    @Column(nullable = false, length = 140)
    private String name;
    private String category;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private StorageType storageType = StorageType.SOLID;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private UnitType unit = UnitType.KG;
    /** Weight of one unit in kg (1 for KG materials). Stock is always stored in kg. */
    private double unitWeightKg = 1;
    private double reorderLevelKg;
    /** Which 3D model the warehouse view draws for this material. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Visual visual = Visual.GENERIC;
    private boolean active = true;
}
