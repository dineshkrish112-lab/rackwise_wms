package com.vollmoon.rackwise.service;

import com.vollmoon.rackwise.common.ApiException;
import com.vollmoon.rackwise.domain.AppUser;
import com.vollmoon.rackwise.domain.Role;
import com.vollmoon.rackwise.dto.Dtos.*;
import com.vollmoon.rackwise.repo.AppUserRepo;
import com.vollmoon.rackwise.security.Current;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class UserService {
    private final AppUserRepo users;
    private final AccessService access;
    private final PasswordEncoder encoder;

    public UserService(AppUserRepo users, AccessService access, PasswordEncoder encoder) {
        this.users = users;
        this.access = access;
        this.encoder = encoder;
    }

    @Transactional(readOnly = true)
    public List<UserDto> list() {
        return users.findByOrganizationIdOrderByFullNameAsc(Current.orgId()).stream().map(Mapper::user).toList();
    }

    public UserDto create(UserRequest r) {
        if (r.role() == Role.SUPER_ADMIN) throw ApiException.forbidden("This role cannot be assigned");
        if (r.password() == null || r.password().length() < 8) throw ApiException.badRequest("Password must be at least 8 characters");
        if (users.existsByEmailIgnoreCase(r.email())) throw ApiException.conflict("Email is already used");
        AppUser u = new AppUser();
        u.setOrganization(access.org());
        apply(u, r);
        u.setPasswordHash(encoder.encode(r.password()));
        return Mapper.user(users.save(u));
    }

    public UserDto update(Long id, UserRequest r) {
        AppUser u = users.findByIdAndOrganizationId(id, Current.orgId()).orElseThrow(() -> ApiException.notFound("User not found"));
        if (r.role() == Role.SUPER_ADMIN) throw ApiException.forbidden("This role cannot be assigned");
        boolean self = u.getId().equals(Current.get().userId());
        if (self && (r.role() != u.getRole() || Boolean.FALSE.equals(r.active())))
            throw ApiException.badRequest("You cannot change your own role or disable yourself");
        if (!u.getEmail().equalsIgnoreCase(r.email()) && users.existsByEmailIgnoreCase(r.email()))
            throw ApiException.conflict("Email is already used");
        apply(u, r);
        if (r.password() != null && !r.password().isBlank()) {
            if (r.password().length() < 8) throw ApiException.badRequest("Password must be at least 8 characters");
            u.setPasswordHash(encoder.encode(r.password()));
        }
        return Mapper.user(u);
    }

    private void apply(AppUser u, UserRequest r) {
        u.setFullName(r.fullName().trim());
        u.setEmail(r.email().trim().toLowerCase());
        u.setRole(r.role());
        u.setPhone(r.phone());
        if (r.active() != null) u.setActive(r.active());
    }
}
