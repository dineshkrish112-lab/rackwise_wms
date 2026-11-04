package com.vollmoon.rackwise.security;

import com.vollmoon.rackwise.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/** Static access to the signed-in user and their organisation (tenant). */
public final class Current {
    private Current() {}

    public static AppPrincipal get() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !(a.getPrincipal() instanceof AppPrincipal p)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Please sign in");
        }
        return p;
    }

    public static Long orgId() {
        Long org = get().orgId();
        if (org == null) throw ApiException.forbidden("This action needs an organisation account");
        return org;
    }

    public static String name() {
        return get().name();
    }
}
