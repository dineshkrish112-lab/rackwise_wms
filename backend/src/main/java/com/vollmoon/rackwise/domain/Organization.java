package com.vollmoon.rackwise.domain;

import com.vollmoon.rackwise.common.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** A customer company (tenant). Every business record belongs to one organisation. */
@Entity
@Table(name = "organizations")
@Getter
@Setter
public class Organization extends BaseEntity {
    @Column(nullable = false, length = 120)
    private String name;
    @Column(nullable = false, unique = true, length = 40)
    private String code;
    private String tagline;
    @Column(length = 9)
    private String brandColor = "#d71920";
    private String address;
    private String contactEmail;
    @Column(length = 20)
    private String plan = "STANDARD";
    private boolean active = true;
}
