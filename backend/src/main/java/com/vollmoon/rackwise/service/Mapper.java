package com.vollmoon.rackwise.service;

import com.vollmoon.rackwise.domain.*;
import com.vollmoon.rackwise.dto.Dtos.*;

import java.time.Duration;
import java.time.LocalDateTime;

/** Entity to DTO conversion. Call inside a transaction so lazy fields can load. */
public final class Mapper {
    private Mapper() {}

    public static OrgDto org(Organization o) {
        if (o == null) return null;
        return new OrgDto(o.getId(), o.getName(), o.getCode(), o.getTagline(), o.getBrandColor(), o.getAddress(),
                o.getContactEmail(), o.getPlan(), o.isActive());
    }

    public static UserDto user(AppUser u) {
        return new UserDto(u.getId(), u.getFullName(), u.getEmail(), u.getRole(), u.getPhone(), u.isActive(),
                u.getLastLoginAt(), u.getCreatedAt());
    }

    public static WarehouseDto warehouse(Warehouse w) {
        return new WarehouseDto(w.getId(), w.getCode(), w.getName(), w.getLocation(), w.getWidthM(), w.getDepthM(),
                w.getDockX(), w.getDockZ(), w.isActive());
    }

    public static MaterialDto material(Material m) {
        return new MaterialDto(m.getId(), m.getCode(), m.getName(), m.getCategory(), m.getStorageType(), m.getUnit(),
                m.getUnitWeightKg(), m.getReorderLevelKg(), m.getVisual(), m.isActive());
    }

    public static BatchDto batch(StockBatch s) {
        Material m = s.getMaterial();
        long age = Math.max(0, Duration.between(s.getReceivedAt(), LocalDateTime.now()).toDays());
        return new BatchDto(s.getId(), s.getWarehouse().getId(), s.getWarehouse().getCode(), s.getBin().getId(), s.getBin().getCode(),
                s.getBin().getRack().getCode(), m.getId(), m.getCode(), m.getName(), m.getUnit(), m.getUnitWeightKg(),
                s.getBatchNo(), round(s.getQtyKg()), s.getReceivedAt(), s.getRefNo(), age);
    }

    public static TxnDto txn(StockTxn t) {
        return new TxnDto(t.getId(), t.getCreatedAt(), t.getType(), t.getWarehouse().getId(), t.getWarehouse().getCode(),
                t.getMaterial().getId(), t.getMaterial().getName(), t.getBinCode(), t.getBatchNo(), round(t.getQtyKg()),
                t.getRefNo(), t.getUserName(), t.getRemarks());
    }

    public static ReceiptDto receipt(Receipt r) {
        Material m = r.getMaterial();
        return new ReceiptDto(r.getId(), r.getWarehouse().getId(), r.getGrnNo(), m.getId(), m.getName(), m.getUnit(), m.getUnitWeightKg(),
                r.getQtyKg(), r.getSupplier(), r.getInvoiceNo(), r.getVehicleNo(), r.getRemarks(), r.getStatus(),
                r.getCreatedByName(), r.getCreatedAt(), r.getStoredAt());
    }

    public static DispatchDto dispatch(Dispatch d, double availableKg) {
        Material m = d.getMaterial();
        return new DispatchDto(d.getId(), d.getWarehouse().getId(), d.getDspNo(), m.getId(), m.getName(), m.getUnit(), m.getUnitWeightKg(),
                d.getQtyKg(), d.getDestination(), d.getCustomerRef(), d.getRemarks(), d.getStatus(), d.getCreatedByName(),
                d.getCreatedAt(), d.getDispatchedAt(), round(availableKg));
    }

    public static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
