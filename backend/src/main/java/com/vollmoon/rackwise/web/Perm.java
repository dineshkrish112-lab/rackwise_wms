package com.vollmoon.rackwise.web;

/** Role rules used in @PreAuthorize. */
public final class Perm {
    private Perm() {}

    public static final String READ = "hasAnyRole('ORG_ADMIN','MANAGER','STORE_KEEPER','VIEWER')";
    public static final String OPERATE = "hasAnyRole('ORG_ADMIN','MANAGER','STORE_KEEPER')";
    public static final String MANAGE = "hasAnyRole('ORG_ADMIN','MANAGER')";
    public static final String ADMIN = "hasRole('ORG_ADMIN')";
    public static final String PLATFORM = "hasRole('SUPER_ADMIN')";
}
