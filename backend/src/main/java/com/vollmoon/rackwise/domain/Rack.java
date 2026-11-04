package com.vollmoon.rackwise.domain;

import com.vollmoon.rackwise.common.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

/** A shelf rack, or a floor zone (rackType FLOOR) split into a grid of floor slots. */
@Entity
@Table(name = "racks", uniqueConstraints = @UniqueConstraint(columnNames = {"warehouse_id", "code"}))
@Getter
@Setter
public class Rack extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "warehouse_id")
    private Warehouse warehouse;
    @Column(nullable = false, length = 20)
    private String code;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private RackType rackType = RackType.RACK;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private StorageType storageType = StorageType.SOLID;
    /** Bays along the rack, or slot columns for a floor zone. */
    private int bays;
    /** Shelf levels, or slot rows for a floor zone. */
    private int levels;
    private double binCapacityKg;
    private double posX;
    private double posZ;
    /** 0 = rack runs along Z (depth), 90 = rack runs along X (width). */
    private int rotation;
    @Column(length = 20)
    private String zoneCode;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "preferred_material_id")
    private Material preferredMaterial;
    @OneToMany(mappedBy = "rack", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("levelNo ASC, bayNo ASC")
    private List<Bin> bins = new ArrayList<>();
}
