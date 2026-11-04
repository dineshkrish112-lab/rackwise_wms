package com.vollmoon.rackwise.service;

import com.vollmoon.rackwise.common.ApiException;
import com.vollmoon.rackwise.domain.Material;
import com.vollmoon.rackwise.dto.Dtos.*;
import com.vollmoon.rackwise.repo.MaterialRepo;
import com.vollmoon.rackwise.repo.StockBatchRepo;
import com.vollmoon.rackwise.security.Current;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class MaterialService {
    private final MaterialRepo materials;
    private final StockBatchRepo stock;
    private final AccessService access;

    public MaterialService(MaterialRepo materials, StockBatchRepo stock, AccessService access) {
        this.materials = materials;
        this.stock = stock;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public List<MaterialDto> list() {
        return materials.findByOrganizationIdOrderByNameAsc(Current.orgId()).stream().map(Mapper::material).toList();
    }

    public MaterialDto create(MaterialRequest r) {
        if (materials.existsByOrganizationIdAndCodeIgnoreCase(Current.orgId(), r.code().trim()))
            throw ApiException.conflict("Material code already exists");
        Material m = new Material();
        m.setOrganization(access.org());
        apply(m, r);
        return Mapper.material(materials.save(m));
    }

    public MaterialDto update(Long id, MaterialRequest r) {
        Material m = access.material(id);
        if (!m.getCode().equalsIgnoreCase(r.code().trim()) && materials.existsByOrganizationIdAndCodeIgnoreCase(Current.orgId(), r.code().trim()))
            throw ApiException.conflict("Material code already exists");
        if (m.getStorageType() != r.storageType() && stock.existsByMaterialId(id))
            throw ApiException.badRequest("Storage type cannot change while this material is in stock");
        apply(m, r);
        return Mapper.material(m);
    }

    public void delete(Long id) {
        Material m = access.material(id);
        if (stock.existsByMaterialId(id)) throw ApiException.badRequest("This material is in stock. Deactivate it instead.");
        materials.delete(m);
        materials.flush();
    }

    private void apply(Material m, MaterialRequest r) {
        m.setCode(r.code().trim().toUpperCase());
        m.setName(r.name().trim());
        m.setCategory(r.category());
        m.setStorageType(r.storageType());
        m.setUnit(r.unit());
        m.setUnitWeightKg(r.unit() == com.vollmoon.rackwise.domain.UnitType.KG ? 1 : r.unitWeightKg());
        m.setReorderLevelKg(r.reorderLevelKg());
        m.setVisual(r.visual());
        if (r.active() != null) m.setActive(r.active());
    }
}
