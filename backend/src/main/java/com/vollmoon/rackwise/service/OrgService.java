package com.vollmoon.rackwise.service;

import com.vollmoon.rackwise.common.ApiException;
import com.vollmoon.rackwise.domain.AppUser;
import com.vollmoon.rackwise.domain.Organization;
import com.vollmoon.rackwise.domain.Role;
import com.vollmoon.rackwise.dto.Dtos.*;
import com.vollmoon.rackwise.repo.AppUserRepo;
import com.vollmoon.rackwise.repo.OrganizationRepo;
import com.vollmoon.rackwise.repo.WarehouseRepo;
import com.vollmoon.rackwise.security.Current;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Organisation settings for customers, and tenant management for the platform owner. */
@Service
@Transactional
public class OrgService {
    private final OrganizationRepo orgs;
    private final AppUserRepo users;
    private final WarehouseRepo warehouses;
    private final PasswordEncoder encoder;

    public OrgService(OrganizationRepo orgs, AppUserRepo users, WarehouseRepo warehouses, PasswordEncoder encoder) {
        this.orgs = orgs;
        this.users = users;
        this.warehouses = warehouses;
        this.encoder = encoder;
    }

    @Transactional(readOnly = true)
    public OrgDto current() {
        return Mapper.org(orgs.findById(Current.orgId()).orElseThrow());
    }

    public OrgDto update(OrgUpdateRequest r) {
        Organization o = orgs.findById(Current.orgId()).orElseThrow();
        o.setName(r.name().trim());
        o.setTagline(r.tagline());
        if (r.brandColor() != null) o.setBrandColor(r.brandColor());
        o.setAddress(r.address());
        o.setContactEmail(r.contactEmail());
        return Mapper.org(o);
    }

    @Transactional(readOnly = true)
    public List<OrgSummaryDto> list() {
        return orgs.findAll(Sort.by("name")).stream()
                .map(o -> new OrgSummaryDto(Mapper.org(o), users.countByOrganizationId(o.getId()),
                        warehouses.countByOrganizationId(o.getId()), o.getCreatedAt()))
                .toList();
    }

    /** Onboard a new customer: creates the organisation and its first administrator. */
    public OrgSummaryDto create(OrgCreateRequest r) {
        if (orgs.existsByCodeIgnoreCase(r.code())) throw ApiException.conflict("Organisation code already exists");
        if (users.existsByEmailIgnoreCase(r.adminEmail())) throw ApiException.conflict("Admin email is already used");
        Organization o = new Organization();
        o.setName(r.name().trim());
        o.setCode(r.code().trim().toUpperCase());
        o.setBrandColor(r.brandColor() == null || r.brandColor().isBlank() ? "#2563eb" : r.brandColor());
        o.setPlan(r.plan() == null || r.plan().isBlank() ? "STANDARD" : r.plan());
        o.setContactEmail(r.adminEmail());
        orgs.save(o);
        AppUser a = new AppUser();
        a.setOrganization(o);
        a.setFullName(r.adminName().trim());
        a.setEmail(r.adminEmail().trim().toLowerCase());
        a.setPasswordHash(encoder.encode(r.adminPassword()));
        a.setRole(Role.ORG_ADMIN);
        users.save(a);
        return new OrgSummaryDto(Mapper.org(o), 1, 0, o.getCreatedAt());
    }

    public OrgDto setActive(Long id, boolean active) {
        Organization o = orgs.findById(id).orElseThrow(() -> ApiException.notFound("Organisation not found"));
        o.setActive(active);
        return Mapper.org(o);
    }
}
