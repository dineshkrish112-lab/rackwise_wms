package com.vollmoon.rackwise.security;

import com.vollmoon.rackwise.domain.Role;

/** The signed-in user, taken from the JWT and re-checked against the database on each request. */
public record AppPrincipal(Long userId, Long orgId, String email, String name, Role role) {
}
