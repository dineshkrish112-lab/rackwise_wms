package com.vollmoon.rackwise.security;

import com.vollmoon.rackwise.domain.AppUser;
import com.vollmoon.rackwise.repo.AppUserRepo;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtService jwt;
    private final AppUserRepo users;

    public JwtAuthFilter(JwtService jwt, AppUserRepo users) {
        this.jwt = jwt;
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                Long uid = jwt.userId(header.substring(7));
                AppUser u = users.findWithOrgById(uid).orElse(null);
                // Deactivated users and suspended organisations lose access immediately.
                boolean ok = u != null && u.isActive() && (u.getOrganization() == null || u.getOrganization().isActive());
                if (ok) {
                    var principal = new AppPrincipal(u.getId(), u.getOrganization() == null ? null : u.getOrganization().getId(),
                            u.getEmail(), u.getFullName(), u.getRole());
                    var auth = new UsernamePasswordAuthenticationToken(principal, null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (Exception ignored) {
                // Invalid or expired token: continue unauthenticated, the API returns 401.
            }
        }
        chain.doFilter(req, res);
    }
}
