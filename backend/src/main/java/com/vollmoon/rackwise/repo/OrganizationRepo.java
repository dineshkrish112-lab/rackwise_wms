package com.vollmoon.rackwise.repo;

import com.vollmoon.rackwise.domain.Organization;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationRepo extends JpaRepository<Organization, Long> {
    boolean existsByCodeIgnoreCase(String code);
}
