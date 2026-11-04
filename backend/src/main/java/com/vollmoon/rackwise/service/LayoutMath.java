package com.vollmoon.rackwise.service;

import com.vollmoon.rackwise.domain.Bin;
import com.vollmoon.rackwise.domain.Rack;
import com.vollmoon.rackwise.domain.RackType;

/** Geometry shared with the 3D view (frontend uses the same numbers). */
public final class LayoutMath {
    public static final double BAY_W = 2.7;
    public static final double SLOT = 3.2;

    private LayoutMath() {}

    /** Floor position (x, z) of the centre of a bin, in metres. */
    public static double[] binXZ(Rack r, Bin b) {
        if (r.getRackType() == RackType.FLOOR) {
            return new double[]{r.getPosX() + (b.getBayNo() - 0.5) * SLOT, r.getPosZ() + (b.getLevelNo() - 0.5) * SLOT};
        }
        double along = (b.getBayNo() - 0.5) * BAY_W;
        return r.getRotation() == 90 ? new double[]{r.getPosX() + along, r.getPosZ()} : new double[]{r.getPosX(), r.getPosZ() + along};
    }

    public static String binCode(Rack r, int level, int bay) {
        return r.getRackType() == RackType.FLOOR
                ? String.format("%s-R%d-S%02d", r.getCode(), level, bay)
                : String.format("%s-L%d-B%02d", r.getCode(), level, bay);
    }
}
