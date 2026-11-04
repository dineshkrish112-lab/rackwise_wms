package com.vollmoon.rackwise.web;

import com.vollmoon.rackwise.dto.Dtos.*;
import com.vollmoon.rackwise.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class AuthController {
    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }

    @PostMapping("/auth/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest r) {
        return auth.login(r);
    }

    @GetMapping("/auth/me")
    public MeDto me() {
        return auth.me();
    }

    @PostMapping("/auth/password")
    public void changePassword(@Valid @RequestBody ChangePasswordRequest r) {
        auth.changePassword(r);
    }

    /** Tokens are stateless; the client deletes its token. Kept for a clean API and audit hooks. */
    @PostMapping("/auth/logout")
    public Map<String, String> logout() {
        return Map.of("message", "Signed out");
    }
}
