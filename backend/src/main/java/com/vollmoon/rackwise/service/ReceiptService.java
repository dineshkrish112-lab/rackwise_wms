package com.vollmoon.rackwise.service;

import com.vollmoon.rackwise.common.ApiException;
import com.vollmoon.rackwise.domain.*;
import com.vollmoon.rackwise.dto.Dtos.*;
import com.vollmoon.rackwise.repo.BinRepo;
import com.vollmoon.rackwise.repo.ReceiptRepo;
import com.vollmoon.rackwise.repo.StockBatchRepo;
import com.vollmoon.rackwise.security.Current;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** Inward flow: goods receipt, nearest-bin putaway suggestion, putaway confirmation. */
@Service
@Transactional
public class ReceiptService {
    private final ReceiptRepo receipts;
    private final BinRepo bins;
    private final StockBatchRepo batches;
    private final StockService stock;
    private final AccessService access;

    public ReceiptService(ReceiptRepo receipts, BinRepo bins, StockBatchRepo batches, StockService stock, AccessService access) {
        this.receipts = receipts;
        this.bins = bins;
        this.batches = batches;
        this.stock = stock;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public List<ReceiptDto> list(Long warehouseId) {
        return receipts.findForWarehouse(access.warehouse(warehouseId).getId()).stream().map(Mapper::receipt).toList();
    }

    public ReceiptDto create(ReceiptRequest r) {
        Warehouse w = access.warehouse(r.warehouseId());
        Material m = access.material(r.materialId());
        if (!m.isActive()) throw ApiException.badRequest(m.getName() + " is inactive");
        Receipt rc = new Receipt();
        rc.setOrganization(w.getOrganization());
        rc.setWarehouse(w);
        rc.setMaterial(m);
        rc.setQtyKg(r.qtyKg());
        rc.setSupplier(r.supplier());
        rc.setInvoiceNo(r.invoiceNo());
        rc.setVehicleNo(r.vehicleNo());
        rc.setRemarks(r.remarks());
        rc.setCreatedByName(Current.name());
        rc.setGrnNo(nextNo("GRN", receipts.countByOrganizationId(w.getOrganization().getId())));
        return Mapper.receipt(receipts.save(rc));
    }

    public ReceiptDto cancel(Long id) {
        Receipt rc = get(id);
        if (rc.getStatus() != ReceiptStatus.PENDING) throw ApiException.badRequest("Only pending receipts can be cancelled");
        rc.setStatus(ReceiptStatus.CANCELLED);
        return Mapper.receipt(rc);
    }

    /**
     * Suggest bins for a receipt. Rules: same storage type; empty bins or bins already holding the same
     * material; racks reserved for this material first; nearest to the dock; heavy loads low down.
     */
    @Transactional(readOnly = true)
    public SuggestionDto suggest(Long id) {
        Receipt rc = get(id);
        return suggest(rc.getWarehouse(), rc.getMaterial(), rc.getQtyKg());
    }

    public SuggestionDto suggest(Warehouse w, Material m, double qtyKg) {
        Map<Long, StockService.BinLoad> loads = stock.binLoads(w.getId());
        Set<Long> racksWithMaterial = new HashSet<>();
        List<Bin> all = bins.findForWarehouse(w.getId());
        Map<Long, Bin> byId = new HashMap<>();
        all.forEach(b -> byId.put(b.getId(), b));
        loads.forEach((binId, l) -> {
            if (l.material.getId().equals(m.getId()) && byId.containsKey(binId)) racksWithMaterial.add(byId.get(binId).getRack().getId());
        });
        boolean heavy = qtyKg >= 1000;
        record Cand(Bin bin, double free, double dist, int priority, double score) {}
        List<Cand> cands = new ArrayList<>();
        for (Bin b : all) {
            Rack r = b.getRack();
            if (b.isBlocked() || r.getStorageType() != m.getStorageType()) continue;
            StockService.BinLoad l = loads.get(b.getId());
            if (l != null && !l.material.getId().equals(m.getId())) continue;
            double free = b.getCapacityKg() - (l == null ? 0 : l.qtyKg);
            if (free < 1) continue;
            Long pref = r.getPreferredMaterial() == null ? null : r.getPreferredMaterial().getId();
            int priority = m.getId().equals(pref) ? 0 : racksWithMaterial.contains(r.getId()) ? 1 : (pref == null ? 2 : 3);
            double[] xz = LayoutMath.binXZ(r, b);
            double dist = Math.abs(xz[0] - w.getDockX()) + Math.abs(xz[1] - w.getDockZ());
            double score = priority * 1000 + dist + (b.getLevelNo() - 1) * (heavy ? 12 : 3) + (l == null ? 0 : -4);
            cands.add(new Cand(b, free, dist, priority, score));
        }
        cands.sort(Comparator.comparingDouble(Cand::score));
        List<AllocationDto> out = new ArrayList<>();
        double left = qtyKg;
        for (Cand c : cands) {
            if (left <= 0.01) break;
            double q = Math.min(left, c.free());
            String reason = switch (c.priority()) {
                case 0 -> "Rack reserved for this material";
                case 1 -> "Same material nearby";
                case 2 -> "Free general rack";
                default -> "Overflow rack";
            };
            if (c.bin().getLevelNo() == 1 && heavy) reason += " · ground level for heavy load";
            out.add(new AllocationDto(c.bin().getId(), c.bin().getCode(), c.bin().getRack().getCode(), c.bin().getLevelNo(),
                    c.bin().getBayNo(), Mapper.round(q), Mapper.round(c.free()), Math.round(c.dist()), reason));
            left -= q;
        }
        return new SuggestionDto(out, Mapper.round(Math.max(0, left)));
    }

    public ReceiptDto putaway(Long id, PutawayRequest req) {
        Receipt rc = get(id);
        if (rc.getStatus() != ReceiptStatus.PENDING) throw ApiException.badRequest("This receipt is already " + rc.getStatus().name().toLowerCase());
        double total = req.allocations().stream().mapToDouble(AllocLine::qtyKg).sum();
        if (Math.abs(total - rc.getQtyKg()) > 0.01)
            throw ApiException.badRequest("Allocated " + Mapper.round(total) + " kg but the receipt is " + Mapper.round(rc.getQtyKg()) + " kg");
        Warehouse w = rc.getWarehouse();
        Material m = rc.getMaterial();
        Map<String, Double> planned = new HashMap<>();
        String batchNo = "B" + rc.getGrnNo().substring(3);
        LocalDateTime now = LocalDateTime.now();
        for (AllocLine line : req.allocations()) {
            String key = line.binCode().trim().toUpperCase();
            Bin b = stock.checkTarget(w, key, m, line.qtyKg(), planned.getOrDefault(key, 0.0));
            planned.merge(key, line.qtyKg(), Double::sum);
            StockBatch s = new StockBatch();
            s.setOrganization(w.getOrganization());
            s.setWarehouse(w);
            s.setBin(b);
            s.setMaterial(m);
            s.setBatchNo(batchNo);
            s.setQtyKg(line.qtyKg());
            s.setReceivedAt(now);
            s.setRefNo(rc.getGrnNo());
            batches.save(s);
            stock.record(w, TxnType.IN, m, b.getCode(), batchNo, line.qtyKg(), rc.getGrnNo(), rc.getSupplier());
        }
        rc.setStatus(ReceiptStatus.STORED);
        rc.setStoredAt(now);
        return Mapper.receipt(rc);
    }

    private Receipt get(Long id) {
        return receipts.findForOrg(id, Current.orgId()).orElseThrow(() -> ApiException.notFound("Receipt not found"));
    }

    static String nextNo(String prefix, long count) {
        return String.format("%s-%s-%05d", prefix, LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyMM")), count + 1);
    }
}
