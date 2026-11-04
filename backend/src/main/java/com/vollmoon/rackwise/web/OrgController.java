package com.vollmoon.rackwise.web;

import com.vollmoon.rackwise.dto.Dtos.*;
import com.vollmoon.rackwise.service.OrgService;
import com.vollmoon.rackwise.service.UserService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class OrgController {
    private final OrgService orgs;
    private final UserService users;

    public OrgController(OrgService orgs, UserService users) {
        this.orgs = orgs;
        this.users = users;
    }

    @GetMapping("/organization")
    @PreAuthorize(Perm.READ)
    public OrgDto current() {
        return orgs.current();
    }

    @PutMapping("/organization")
    @PreAuthorize(Perm.ADMIN)
    public OrgDto update(@Valid @RequestBody OrgUpdateRequest r) {
        return orgs.update(r);
    }

    @GetMapping("/users")
    @PreAuthorize(Perm.ADMIN)
    public List<UserDto> users() {
        return users.list();
    }

    @PostMapping("/users")
    @PreAuthorize(Perm.ADMIN)
    public UserDto createUser(@Valid @RequestBody UserRequest r) {
        return users.create(r);
    }

    @PutMapping("/users/{id}")
    @PreAuthorize(Perm.ADMIN)
    public UserDto updateUser(@PathVariable Long id, @Valid @RequestBody UserRequest r) {
        return users.update(id, r);
    }

    // ---------- platform owner: manage customer organisations ----------

    @GetMapping("/platform/organizations")
    @PreAuthorize(Perm.PLATFORM)
    public List<OrgSummaryDto> list() {
        return orgs.list();
    }

    @PostMapping("/platform/organizations")
    @PreAuthorize(Perm.PLATFORM)
    public OrgSummaryDto create(@Valid @RequestBody OrgCreateRequest r) {
        return orgs.create(r);
    }

    @PatchMapping("/platform/organizations/{id}")
    @PreAuthorize(Perm.PLATFORM)
    public OrgDto setActive(@PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        return orgs.setActive(id, Boolean.TRUE.equals(body.get("active")));
    }
}
