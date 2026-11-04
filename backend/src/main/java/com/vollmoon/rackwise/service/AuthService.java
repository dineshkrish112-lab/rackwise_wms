package com.vollmoon.rackwise.service;

import com.vollmoon.rackwise.common.ApiException;
import com.vollmoon.rackwise.domain.AppUser;
import com.vollmoon.rackwise.dto.Dtos.*;
import com.vollmoon.rackwise.repo.AppUserRepo;
import com.vollmoon.rackwise.security.Current;
import com.vollmoon.rackwise.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@Transactional
public class AuthService {
    private final AppUserRepo users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthService(AppUserRepo users, PasswordEncoder encoder, JwtService jwt) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    public LoginResponse login(LoginRequest r) {
        AppUser u = users.findByEmailIgnoreCase(r.email().trim())
                .filter(x -> encoder.matches(r.password(), x.getPasswordHash()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect"));
        if (!u.isActive()) throw ApiException.forbidden("Your account is disabled. Contact your administrator.");
        if (u.getOrganization() != null && !u.getOrganization().isActive())
            throw ApiException.forbidden("Your organisation's subscription is inactive. Contact support.");
        u.setLastLoginAt(LocalDateTime.now());
        return new LoginResponse(jwt.issue(u), me(u));
    }

    @Transactional(readOnly = true)
    public MeDto me() {
        AppUser u = users.findWithOrgById(Current.get().userId()).orElseThrow(() -> ApiException.notFound("User not found"));
        return me(u);
    }

    public void changePassword(ChangePasswordRequest r) {
        AppUser u = users.findById(Current.get().userId()).orElseThrow();
        if (!encoder.matches(r.currentPassword(), u.getPasswordHash()))
            throw ApiException.badRequest("Current password is incorrect");
        u.setPasswordHash(encoder.encode(r.newPassword()));
    }

    private MeDto me(AppUser u) {
        return new MeDto(Mapper.user(u), Mapper.org(u.getOrganization()));
    }
}
