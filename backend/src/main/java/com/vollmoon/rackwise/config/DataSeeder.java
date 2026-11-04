package com.vollmoon.rackwise.config;

import com.vollmoon.rackwise.domain.*;
import com.vollmoon.rackwise.repo.*;
import com.vollmoon.rackwise.service.LayoutMath;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Creates demo data on first start (empty database): the platform owner, the Texmo organisation with
 * four warehouses, and a small second customer to show multi-tenancy. Demo logins are listed in README.md.
 * Turn off with SEED_DEMO_DATA=false.
 */
@Component
public class DataSeeder implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final OrganizationRepo orgs;
    private final AppUserRepo users;
    private final WarehouseRepo warehouses;
    private final RackRepo racks;
    private final MaterialRepo materials;
    private final StockBatchRepo batches;
    private final StockTxnRepo txns;
    private final ReceiptRepo receipts;
    private final DispatchRepo dispatches;
    private final PasswordEncoder encoder;
    private final boolean enabled;
    private final Random rnd = new Random(42);
    private int batchSeq = 1, grnSeq = 0, dspSeq = 0;

    public DataSeeder(OrganizationRepo orgs, AppUserRepo users, WarehouseRepo warehouses, RackRepo racks, MaterialRepo materials,
                      StockBatchRepo batches, StockTxnRepo txns, ReceiptRepo receipts, DispatchRepo dispatches,
                      PasswordEncoder encoder, @Value("${app.seed-demo-data:true}") boolean enabled) {
        this.orgs = orgs;
        this.users = users;
        this.warehouses = warehouses;
        this.racks = racks;
        this.materials = materials;
        this.batches = batches;
        this.txns = txns;
        this.receipts = receipts;
        this.dispatches = dispatches;
        this.encoder = encoder;
        this.enabled = enabled;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (!enabled || orgs.count() > 0) return;
        log.info("Empty database: creating demo data...");

        user(null, "Platform Owner", "owner@rackwise.app", "Owner@12345", Role.SUPER_ADMIN);

        // ---------- Texmo ----------
        Organization texmo = org("Texmo Industries", "TEXMO", "Pumps · Motors · Solutions", "#d71920", "Coimbatore, Tamil Nadu");
        user(texmo, "Arun Kumar", "admin@texmo.com", "Admin@12345", Role.ORG_ADMIN);
        user(texmo, "Priya Raman", "manager@texmo.com", "Manager@12345", Role.MANAGER);
        user(texmo, "Dinesh Babu", "store@texmo.com", "Store@12345", Role.STORE_KEEPER);
        user(texmo, "Kavya Suresh", "viewer@texmo.com", "Viewer@12345", Role.VIEWER);

        Material steel40 = material(texmo, "MS-ROD-40", "Steel rod Ø40 mm", "Raw material", StorageType.SOLID, UnitType.KG, 1, 6000, Visual.STEEL);
        Material steel25 = material(texmo, "MS-ROD-25", "Steel rod Ø25 mm", "Raw material", StorageType.SOLID, UnitType.KG, 1, 2000, Visual.STEEL);
        Material copper = material(texmo, "CU-WIRE-12", "Copper winding wire 1.2 mm", "Raw material", StorageType.SOLID, UnitType.KG, 1, 4000, Visual.COPPER);
        Material casting = material(texmo, "CI-VOLUTE-3", "Pump casting (volute)", "Components", StorageType.SOLID, UnitType.NOS, 40, 3000, Visual.CASTING);
        Material bearing = material(texmo, "BRG-6205", "Bearing set 6205", "Components", StorageType.SOLID, UnitType.NOS, 2, 1500, Visual.CARTON);
        Material packing = material(texmo, "PKG-CTN-L", "Packing cartons (large)", "Consumables", StorageType.SOLID, UnitType.NOS, 1, 500, Visual.CARTON);
        Material stator = material(texmo, "STR-CORE-90", "Stator core lamination", "Components", StorageType.SOLID, UnitType.KG, 1, 3000, Visual.CRATE);
        Material coolant = material(texmo, "COOL-200", "Coolant 200 L drum", "Liquids", StorageType.LIQUID, UnitType.DRUM, 200, 1600, Visual.DRUM);
        Material oil = material(texmo, "HYD-OIL-68", "Hydraulic oil 68", "Liquids", StorageType.LIQUID, UnitType.DRUM, 200, 800, Visual.DRUM);
        Material motor = material(texmo, "MTR-5HP", "Induction motor 5 HP", "Finished goods", StorageType.EQUIPMENT, UnitType.NOS, 150, 1500, Visual.MOTOR);
        Material pump = material(texmo, "PMP-SUB-1HP", "Submersible pump 1 HP", "Finished goods", StorageType.EQUIPMENT, UnitType.NOS, 60, 600, Visual.PUMP);

        String[][] whs = {{"WH-A", "Coimbatore main", "Coimbatore"}, {"WH-B", "Saravanampatti", "Saravanampatti, Coimbatore"},
                {"WH-C", "Perundurai", "Perundurai, Erode"}, {"WH-D", "Avinashi", "Avinashi, Tiruppur"}};
        for (String[] wd : whs) {
            Warehouse w = warehouse(texmo, wd[0], wd[1], wd[2]);
            List<Rack> rs = new ArrayList<>();
            rs.add(rack(w, "A1", RackType.RACK, StorageType.SOLID, 5, 4, 2000, -17, -19, "Z-ST", steel40));
            rs.add(rack(w, "A2", RackType.RACK, StorageType.SOLID, 5, 4, 2000, -12.5, -19, "Z-ST", copper));
            rs.add(rack(w, "B1", RackType.RACK, StorageType.SOLID, 5, 4, 2000, -4.5, -19, "Z-ST", casting));
            rs.add(rack(w, "B2", RackType.RACK, StorageType.SOLID, 5, 4, 2000, 0, -19, "Z-ST", bearing));
            rs.add(rack(w, "B3", RackType.RACK, StorageType.SOLID, 5, 4, 2000, 8, -19, "Z-ST", stator));
            rs.add(rack(w, "C1", RackType.RACK, StorageType.SOLID, 5, 4, 2000, 12.5, -19, "Z-ST", null));
            rs.add(rack(w, "L1", RackType.RACK, StorageType.LIQUID, 4, 2, 1600, -25, 2.5, "Z-LQ", coolant));
            rs.add(rack(w, "E1", RackType.FLOOR, StorageType.EQUIPMENT, 4, 3, 1000, 7, 3.5, "Z-EQ", motor));
            Map<String, List<Material>> extra = Map.of("C1", List.of(packing, steel25), "L1", List.of(coolant, coolant, oil), "E1", List.of(motor, motor, pump));
            fillStock(w, rs, extra);
            history(w, List.of(steel40, steel25, copper, casting, bearing, packing, stator, coolant, oil, motor, pump));
            receipt(w, steel40, 2000, "JSW Steel", "TN-38-BX-4120");
            receipt(w, coolant, 800, "Gulf Oil Lubricants", "TN-37-CQ-9081");
            receipt(w, motor, 450, "Texmo motor line 2", "Internal");
            receipt(w, copper, 1200, "Hindalco", "TN-66-AK-2210");
            dispatch(w, steel40, 700, "Assembly line 3");
            dispatch(w, copper, 500, "Motor winding shop");
            dispatch(w, bearing, 300, "Pump assembly");
        }

        // ---------- second customer (shows multi-tenancy) ----------
        Organization demo = org("Demo Industries", "DEMO", "Smart storage for growing teams", "#2563eb", "Chennai, Tamil Nadu");
        user(demo, "Demo Admin", "admin@demo.com", "Admin@12345", Role.ORG_ADMIN);
        Material dBox = material(demo, "FG-BOX", "Finished goods cartons", "Finished goods", StorageType.SOLID, UnitType.NOS, 5, 1000, Visual.CARTON);
        Material dOil = material(demo, "LUBE-20", "Lubricant 20 L drum", "Liquids", StorageType.LIQUID, UnitType.DRUM, 20, 200, Visual.DRUM);
        Warehouse dw = warehouse(demo, "CHN-1", "Chennai hub", "Ambattur, Chennai");
        List<Rack> drs = List.of(rack(dw, "R1", RackType.RACK, StorageType.SOLID, 6, 3, 1500, -10, -18, "Z-ST", dBox),
                rack(dw, "R2", RackType.RACK, StorageType.SOLID, 6, 3, 1500, -5, -18, "Z-ST", dBox),
                rack(dw, "L1", RackType.RACK, StorageType.LIQUID, 3, 2, 800, 6, -18, "Z-LQ", dOil));
        fillStock(dw, drs, Map.of());
        history(dw, List.of(dBox, dOil));
        log.info("Demo data ready. Sign-in accounts are listed in README.md");
    }

    // ---------- builders ----------

    private Organization org(String name, String code, String tagline, String color, String address) {
        Organization o = new Organization();
        o.setName(name);
        o.setCode(code);
        o.setTagline(tagline);
        o.setBrandColor(color);
        o.setAddress(address);
        o.setContactEmail("admin@" + code.toLowerCase() + ".com");
        o.setPlan("ENTERPRISE");
        return orgs.save(o);
    }

    private void user(Organization o, String name, String email, String password, Role role) {
        AppUser u = new AppUser();
        u.setOrganization(o);
        u.setFullName(name);
        u.setEmail(email);
        u.setPasswordHash(encoder.encode(password));
        u.setRole(role);
        users.save(u);
    }

    private Material material(Organization o, String code, String name, String cat, StorageType st, UnitType unit, double unitW, double reorder, Visual v) {
        Material m = new Material();
        m.setOrganization(o);
        m.setCode(code);
        m.setName(name);
        m.setCategory(cat);
        m.setStorageType(st);
        m.setUnit(unit);
        m.setUnitWeightKg(unitW);
        m.setReorderLevelKg(reorder);
        m.setVisual(v);
        return materials.save(m);
    }

    private Warehouse warehouse(Organization o, String code, String name, String location) {
        Warehouse w = new Warehouse();
        w.setOrganization(o);
        w.setCode(code);
        w.setName(name);
        w.setLocation(location);
        return warehouses.save(w);
    }

    private Rack rack(Warehouse w, String code, RackType type, StorageType st, int bays, int levels, double cap, double x, double z,
                      String zone, Material preferred) {
        Rack r = new Rack();
        r.setWarehouse(w);
        r.setCode(code);
        r.setRackType(type);
        r.setStorageType(st);
        r.setBays(bays);
        r.setLevels(levels);
        r.setBinCapacityKg(cap);
        r.setPosX(x);
        r.setPosZ(z);
        r.setZoneCode(zone);
        r.setPreferredMaterial(preferred);
        for (int l = 1; l <= levels; l++)
            for (int b = 1; b <= bays; b++) {
                Bin bin = new Bin();
                bin.setRack(r);
                bin.setWarehouse(w);
                bin.setLevelNo(l);
                bin.setBayNo(b);
                bin.setCapacityKg(cap);
                bin.setCode(LayoutMath.binCode(r, l, b));
                r.getBins().add(bin);
            }
        return racks.save(r);
    }

    private void fillStock(Warehouse w, List<Rack> rs, Map<String, List<Material>> extra) {
        double fillP = 0.55 + rnd.nextDouble() * 0.2;
        for (Rack r : rs) {
            List<Bin> list = r.getBins();
            int keepEmpty = rnd.nextInt(r.getBays()); // one free ground-level bin for the putaway demo
            for (Bin b : list) {
                if (b.getLevelNo() == 1 && b.getBayNo() == keepEmpty + 1) continue;
                if (rnd.nextDouble() > fillP) continue;
                List<Material> opts = extra.get(r.getCode());
                Material m = opts != null ? opts.get(rnd.nextInt(opts.size())) : r.getPreferredMaterial();
                if (m == null) continue;
                double qty = (0.3 + rnd.nextDouble() * 0.7) * b.getCapacityKg();
                qty = m.getUnit() == UnitType.KG ? Math.round(qty / 50) * 50 : Math.max(1, Math.floor(qty / m.getUnitWeightKg())) * m.getUnitWeightKg();
                qty = Math.min(qty, b.getCapacityKg());
                LocalDateTime at = LocalDateTime.now().minusDays(2 + rnd.nextInt(70)).withHour(9 + rnd.nextInt(8)).withMinute(rnd.nextInt(60));
                StockBatch s = new StockBatch();
                s.setOrganization(w.getOrganization());
                s.setWarehouse(w);
                s.setBin(b);
                s.setMaterial(m);
                s.setBatchNo(String.format("B-%s-%05d", at.format(DateTimeFormatter.ofPattern("yyMM")), batchSeq++));
                s.setQtyKg(qty);
                s.setReceivedAt(at);
                s.setRefNo("OPENING");
                batches.save(s);
                txn(w, TxnType.IN, m, b.getCode(), s.getBatchNo(), qty, "OPENING", at, "Opening stock");
            }
        }
    }

    /** About 90 days of movements so the reports have something to show. */
    private void history(Warehouse w, List<Material> mats) {
        LocalDate start = LocalDate.now().minusDays(90);
        int ref = 1;
        for (LocalDate d = start; d.isBefore(LocalDate.now()); d = d.plusDays(1)) {
            if (d.getDayOfWeek() == DayOfWeek.SUNDAY) continue;
            double season = 1 + 0.35 * Math.sin(d.getDayOfYear() / 9.0);
            int outs = (int) Math.round((2 + rnd.nextInt(5)) * season);
            for (int i = 0; i < outs; i++) {
                Material m = mats.get(rnd.nextInt(mats.size()));
                double q = Math.round((100 + rnd.nextDouble() * 900) / 10) * 10.0;
                txn(w, TxnType.OUT, m, null, null, q, "DSP-H" + w.getId() + "-" + (ref++), d.atTime(8 + rnd.nextInt(10), rnd.nextInt(60)), "History");
            }
            int ins = 1 + rnd.nextInt(3);
            for (int i = 0; i < ins; i++) {
                Material m = mats.get(rnd.nextInt(mats.size()));
                double q = Math.round((300 + rnd.nextDouble() * 1700) / 10) * 10.0;
                txn(w, TxnType.IN, m, null, null, q, "GRN-H" + w.getId() + "-" + (ref++), d.atTime(8 + rnd.nextInt(10), rnd.nextInt(60)), "History");
            }
        }
    }

    private void txn(Warehouse w, TxnType type, Material m, String bin, String batch, double qty, String ref, LocalDateTime at, String remarks) {
        StockTxn t = new StockTxn();
        t.setOrganization(w.getOrganization());
        t.setWarehouse(w);
        t.setType(type);
        t.setMaterial(m);
        t.setBinCode(bin);
        t.setBatchNo(batch);
        t.setQtyKg(qty);
        t.setRefNo(ref);
        t.setUserName("System");
        t.setRemarks(remarks);
        t.setCreatedAt(at);
        txns.save(t);
    }

    private void receipt(Warehouse w, Material m, double qty, String supplier, String vehicle) {
        Receipt r = new Receipt();
        r.setOrganization(w.getOrganization());
        r.setWarehouse(w);
        r.setMaterial(m);
        r.setQtyKg(qty);
        r.setSupplier(supplier);
        r.setVehicleNo(vehicle);
        r.setInvoiceNo("INV-" + (8000 + rnd.nextInt(1999)));
        r.setCreatedByName("Dinesh Babu");
        r.setGrnNo(String.format("GRN-%s-%05d", LocalDate.now().format(DateTimeFormatter.ofPattern("yyMM")), ++grnSeq));
        receipts.save(r);
    }

    private void dispatch(Warehouse w, Material m, double qty, String to) {
        Dispatch d = new Dispatch();
        d.setOrganization(w.getOrganization());
        d.setWarehouse(w);
        d.setMaterial(m);
        d.setQtyKg(qty);
        d.setDestination(to);
        d.setCreatedByName("Priya Raman");
        d.setDspNo(String.format("DSP-%s-%05d", LocalDate.now().format(DateTimeFormatter.ofPattern("yyMM")), ++dspSeq));
        dispatches.save(d);
    }
}
