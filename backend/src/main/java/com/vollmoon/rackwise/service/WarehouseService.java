package com.vollmoon.rackwise.service;

import com.vollmoon.rackwise.common.ApiException;
import com.vollmoon.rackwise.domain.*;
import com.vollmoon.rackwise.dto.Dtos.*;
import com.vollmoon.rackwise.repo.*;
import com.vollmoon.rackwise.security.Current;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/** Warehouses, the rack builder, and the layout data that drives the 3D view. */
@Service
@Transactional
public class WarehouseService {
    private final WarehouseRepo warehouses;
    private final RackRepo racks;
    private final BinRepo bins;
    private final StockBatchRepo batches;
    private final StockService stock;
    private final AccessService access;

    public WarehouseService(WarehouseRepo warehouses, RackRepo racks, BinRepo bins, StockBatchRepo batches,
                            StockService stock, AccessService access) {
        this.warehouses = warehouses;
        this.racks = racks;
        this.bins = bins;
        this.batches = batches;
        this.stock = stock;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public List<WarehouseDto> list() {
        return warehouses.findByOrganizationIdOrderByCodeAsc(Current.orgId()).stream().map(Mapper::warehouse).toList();
    }

    public WarehouseDto create(WarehouseRequest r) {
        if (warehouses.existsByOrganizationIdAndCodeIgnoreCase(Current.orgId(), r.code().trim()))
            throw ApiException.conflict("Warehouse code already exists");
        Warehouse w = new Warehouse();
        w.setOrganization(access.org());
        apply(w, r);
        return Mapper.warehouse(warehouses.save(w));
    }

    public WarehouseDto update(Long id, WarehouseRequest r) {
        Warehouse w = access.warehouse(id);
        if (!w.getCode().equalsIgnoreCase(r.code().trim()) && warehouses.existsByOrganizationIdAndCodeIgnoreCase(Current.orgId(), r.code().trim()))
            throw ApiException.conflict("Warehouse code already exists");
        apply(w, r);
        return Mapper.warehouse(w);
    }

    public void delete(Long id) {
        Warehouse w = access.warehouse(id);
        if (batches.existsByWarehouseId(id)) throw ApiException.badRequest("Move or dispatch all stock before deleting this warehouse");
        racks.deleteAll(racks.findForWarehouse(id));
        racks.flush();
        warehouses.delete(w);
        warehouses.flush();
    }

    private void apply(Warehouse w, WarehouseRequest r) {
        w.setCode(r.code().trim().toUpperCase());
        w.setName(r.name().trim());
        w.setLocation(r.location());
        if (r.widthM() != null) w.setWidthM(r.widthM());
        if (r.depthM() != null) w.setDepthM(r.depthM());
        if (r.dockX() != null) w.setDockX(r.dockX());
        if (r.dockZ() != null) w.setDockZ(r.dockZ());
        if (r.active() != null) w.setActive(r.active());
    }

    @Transactional(readOnly = true)
    public LayoutDto layout(Long warehouseId) {
        Warehouse w = access.warehouse(warehouseId);
        Map<Long, StockService.BinLoad> loads = stock.binLoads(w.getId());
        Map<Long, List<Bin>> binsByRack = new HashMap<>();
        for (Bin b : bins.findForWarehouse(w.getId())) binsByRack.computeIfAbsent(b.getRack().getId(), k -> new ArrayList<>()).add(b);
        List<RackDto> rackDtos = racks.findForWarehouse(w.getId()).stream().map(r -> {
            List<BinDto> bd = binsByRack.getOrDefault(r.getId(), List.of()).stream()
                    .sorted(Comparator.comparingInt(Bin::getLevelNo).thenComparingInt(Bin::getBayNo))
                    .map(b -> binDto(b, loads.get(b.getId()))).toList();
            Material pm = r.getPreferredMaterial();
            return new RackDto(r.getId(), r.getCode(), r.getRackType(), r.getStorageType(), r.getBays(), r.getLevels(), r.getBinCapacityKg(),
                    r.getPosX(), r.getPosZ(), r.getRotation(), r.getZoneCode(), pm == null ? null : pm.getId(), pm == null ? null : pm.getName(), bd);
        }).toList();
        return new LayoutDto(Mapper.warehouse(w), rackDtos);
    }

    private BinDto binDto(Bin b, StockService.BinLoad l) {
        Material m = l == null ? null : l.material;
        return new BinDto(b.getId(), b.getCode(), b.getLevelNo(), b.getBayNo(), b.getCapacityKg(), l == null ? 0 : Mapper.round(l.qtyKg),
                b.isBlocked(), m == null ? null : m.getId(), m == null ? null : m.getName(), m == null ? null : m.getVisual(),
                m == null ? null : m.getUnit(), m == null ? 1 : m.getUnitWeightKg(), l == null ? null : l.oldest, l == null ? 0 : l.batches);
    }

    // ---------- rack builder ----------

    public RackDto createRack(Long warehouseId, RackRequest r) {
        Warehouse w = access.warehouse(warehouseId);
        if (racks.existsByWarehouseIdAndCodeIgnoreCase(w.getId(), r.code().trim())) throw ApiException.conflict("Rack code already exists in this warehouse");
        Rack rack = new Rack();
        rack.setWarehouse(w);
        applyRack(rack, r);
        generateBins(rack);
        racks.save(rack);
        return layout(w.getId()).racks().stream().filter(x -> x.id().equals(rack.getId())).findFirst().orElseThrow();
    }

    public RackDto updateRack(Long warehouseId, Long rackId, RackRequest r) {
        Warehouse w = access.warehouse(warehouseId);
        Rack rack = racks.findByIdAndWarehouseId(rackId, w.getId()).orElseThrow(() -> ApiException.notFound("Rack not found"));
        if (!rack.getCode().equalsIgnoreCase(r.code().trim()) && racks.existsByWarehouseIdAndCodeIgnoreCase(w.getId(), r.code().trim()))
            throw ApiException.conflict("Rack code already exists in this warehouse");
        boolean hasStock = batches.existsByBinRackId(rack.getId());
        boolean structural = rack.getBays() != r.bays() || rack.getLevels() != r.levels() || rack.getRackType() != r.rackType();
        if (hasStock && (structural || rack.getStorageType() != r.storageType()))
            throw ApiException.badRequest("Empty this rack before changing its type, bays, levels or storage type");
        boolean codeChanged = !rack.getCode().equals(r.code().trim().toUpperCase());
        applyRack(rack, r);
        if (structural) {
            rack.getBins().clear();
            racks.saveAndFlush(rack); // delete old bins before inserting new codes
            generateBins(rack);
        } else {
            for (Bin b : rack.getBins()) {
                b.setCapacityKg(r.binCapacityKg());
                if (codeChanged) b.setCode(LayoutMath.binCode(rack, b.getLevelNo(), b.getBayNo()));
            }
        }
        racks.saveAndFlush(rack);
        return layout(w.getId()).racks().stream().filter(x -> x.id().equals(rack.getId())).findFirst().orElseThrow();
    }

    public void deleteRack(Long warehouseId, Long rackId) {
        Warehouse w = access.warehouse(warehouseId);
        Rack rack = racks.findByIdAndWarehouseId(rackId, w.getId()).orElseThrow(() -> ApiException.notFound("Rack not found"));
        if (batches.existsByBinRackId(rackId)) throw ApiException.badRequest("Empty this rack before deleting it");
        racks.delete(rack);
    }

    private void applyRack(Rack rack, RackRequest r) {
        rack.setCode(r.code().trim().toUpperCase());
        rack.setRackType(r.rackType());
        rack.setStorageType(r.storageType());
        rack.setBays(r.bays());
        rack.setLevels(r.levels());
        rack.setBinCapacityKg(r.binCapacityKg());
        rack.setPosX(r.posX());
        rack.setPosZ(r.posZ());
        rack.setRotation(r.rackType() == RackType.FLOOR ? 0 : (r.rotation() == 90 ? 90 : 0));
        rack.setZoneCode(r.zoneCode());
        if (r.preferredMaterialId() != null) {
            Material m = access.material(r.preferredMaterialId());
            if (m.getStorageType() != r.storageType()) throw ApiException.badRequest(m.getName() + " cannot be stored in a " + r.storageType().name().toLowerCase() + " rack");
            rack.setPreferredMaterial(m);
        } else {
            rack.setPreferredMaterial(null);
        }
    }

    private void generateBins(Rack rack) {
        for (int l = 1; l <= rack.getLevels(); l++) {
            for (int b = 1; b <= rack.getBays(); b++) {
                Bin bin = new Bin();
                bin.setRack(rack);
                bin.setWarehouse(rack.getWarehouse());
                bin.setLevelNo(l);
                bin.setBayNo(b);
                bin.setCapacityKg(rack.getBinCapacityKg());
                bin.setCode(LayoutMath.binCode(rack, l, b));
                rack.getBins().add(bin);
            }
        }
    }
}
