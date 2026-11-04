package com.vollmoon.rackwise.security;

import com.vollmoon.rackwise.domain.AppUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;

@Service
public class JwtService {
    private final SecretKey key;
    private final long ttlMs;

    public JwtService(@Value("${app.jwt.secret:}") String secret, @Value("${app.jwt.ttl-hours:12}") long ttlHours) {
        if (secret == null || secret.isBlank()) {
            // No JWT_SECRET configured: use a random key. Fine for development, but every restart signs everyone out.
            org.slf4j.LoggerFactory.getLogger(JwtService.class).warn("JWT_SECRET is not set; using a random key for this run. Set JWT_SECRET in production.");
            this.key = Jwts.SIG.HS512.key().build();
        } else {
            this.key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
        }
        this.ttlMs = ttlHours * 3_600_000L;
    }

    public String issue(AppUser u) {
        var b = Jwts.builder()
                .subject(u.getEmail())
                .claim("uid", u.getId())
                .claim("role", u.getRole().name())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + ttlMs));
        if (u.getOrganization() != null) b.claim("org", u.getOrganization().getId());
        return b.signWith(key).compact();
    }

    /** Returns the user id inside a valid token. Throws if the token is invalid or expired. */
    public Long userId(String token) {
        Claims c = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        return ((Number) c.get("uid")).longValue();
    }
}
