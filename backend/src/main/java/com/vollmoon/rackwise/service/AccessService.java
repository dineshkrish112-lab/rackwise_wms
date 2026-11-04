package com.vollmoon.rackwise.service;

import com.vollmoon.rackwise.common.ApiException;
import com.vollmoon.rackwise.domain.Material;
import com.vollmoon.rackwise.domain.Organization;
import com.vollmoon.rackwise.domain.Warehouse;
import com.vollmoon.rackwise.repo.MaterialRepo;
import com.vollmoon.rackwise.repo.OrganizationRepo;
import com.vollmoon.rackwise.repo.WarehouseRepo;
import com.vollmoon.rackwise.security.Current;
import org.springframework.stereotype.Service;

/** Loads records only when they belong to the signed-in user's organisation. */
@Service
public class AccessService {
    private final WarehouseRepo warehouses;
    private final MaterialRepo materials;
    private final OrganizationRepo orgs;

    public AccessService(WarehouseRepo warehouses, MaterialRepo materials, OrganizationRepo orgs) {
        this.warehouses = warehouses;
        this.materials = materials;
        this.orgs = orgs;
    }

    public Warehouse warehouse(Long id) {
        return warehouses.findByIdAndOrganizationId(id, Current.orgId())
                .orElseThrow(() -> ApiException.notFound("Warehouse not found"));
    }

    public Material material(Long id) {
        return materials.findByIdAndOrganizationId(id, Current.orgId())
                .orElseThrow(() -> ApiException.notFound("Material not found"));
    }

    public Organization org() {
        return orgs.getReferenceById(Current.orgId());
    }
}
