package com.vollmoon.rackwise.service;

import com.vollmoon.rackwise.common.ApiException;
import com.vollmoon.rackwise.domain.*;
import com.vollmoon.rackwise.dto.Dtos.*;
import com.vollmoon.rackwise.repo.BinRepo;
import com.vollmoon.rackwise.repo.MaterialRepo;
import com.vollmoon.rackwise.repo.StockBatchRepo;
import com.vollmoon.rackwise.repo.StockTxnRepo;
import com.vollmoon.rackwise.security.Current;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
@Transactional
public class StockService {
    private final StockBatchRepo batches;
    private final StockTxnRepo txns;
    private final BinRepo bins;
    private final MaterialRepo materials;
    private final AccessService access;

    public StockService(StockBatchRepo batches, StockTxnRepo txns, BinRepo bins, MaterialRepo materials, AccessService access) {
        this.batches = batches;
        this.txns = txns;
        this.bins = bins;
        this.materials = materials;
        this.access = access;
    }

    /** What is currently in a bin: total kg, which material, oldest batch. */
    public static final class BinLoad {
        public double qtyKg;
        public Material material;
        public LocalDateTime oldest;
        public int batches;
    }

    @Transactional(readOnly = true)
    public Map<Long, BinLoad> binLoads(Long warehouseId) {
        Map<Long, BinLoad> map = new HashMap<>();
        for (StockBatch s : batches.findForWarehouse(warehouseId)) {
            if (s.getQtyKg() <= 0) continue;
            BinLoad l = map.computeIfAbsent(s.getBin().getId(), k -> new BinLoad());
            l.qtyKg += s.getQtyKg();
            l.material = s.getMaterial();
            l.batches++;
            if (l.oldest == null || s.getReceivedAt().isBefore(l.oldest)) l.oldest = s.getReceivedAt();
        }
        return map;
    }

    @Transactional(readOnly = true)
    public List<BatchDto> batches(Long warehouseId, Long materialId, String q) {
        List<StockBatch> list = warehouseId != null ? batches.findForWarehouse(access.warehouse(warehouseId).getId())
                : batches.findForOrg(Current.orgId());
        String query = q == null ? "" : q.trim().toLowerCase();
        return list.stream()
                .filter(s -> s.getQtyKg() > 0)
                .filter(s -> materialId == null || s.getMaterial().getId().equals(materialId))
                .filter(s -> query.isEmpty() || s.getBin().getCode().toLowerCase().contains(query)
                        || s.getMaterial().getName().toLowerCase().contains(query)
                        || s.getMaterial().getCode().toLowerCase().contains(query)
                        || s.getBatchNo().toLowerCase().contains(query))
                .sorted(Comparator.comparing((StockBatch s) -> s.getBin().getCode()).thenComparing(StockBatch::getReceivedAt))
                .map(Mapper::batch).toList();
    }

    @Transactional(readOnly = true)
    public List<MaterialStockDto> materialSummary(Long warehouseId) {
        List<StockBatch> list = warehouseId != null ? batches.findForWarehouse(access.warehouse(warehouseId).getId())
                : batches.findForOrg(Current.orgId());
        Map<Long, double[]> qty = new HashMap<>();
        Map<Long, Set<Long>> binsByMat = new HashMap<>();
        Map<Long, LocalDateTime> oldest = new HashMap<>();
        for (StockBatch s : list) {
            if (s.getQtyKg() <= 0) continue;
            Long id = s.getMaterial().getId();
            qty.computeIfAbsent(id, k -> new double[1])[0] += s.getQtyKg();
            binsByMat.computeIfAbsent(id, k -> new HashSet<>()).add(s.getBin().getId());
            oldest.merge(id, s.getReceivedAt(), (a, b) -> a.isBefore(b) ? a : b);
        }
        return materials.findByOrganizationIdOrderByNameAsc(Current.orgId()).stream()
                .filter(m -> m.isActive() || qty.containsKey(m.getId()))
                .map(m -> {
                    double q = qty.getOrDefault(m.getId(), new double[1])[0];
                    return new MaterialStockDto(m.getId(), m.getCode(), m.getName(), m.getCategory(), m.getUnit(), m.getUnitWeightKg(),
                            Mapper.round(q), binsByMat.getOrDefault(m.getId(), Set.of()).size(), oldest.get(m.getId()),
                            m.getReorderLevelKg(), m.getReorderLevelKg() > 0 && q < m.getReorderLevelKg());
                }).toList();
    }

    @Transactional(readOnly = true)
    public BinDetailDto binDetail(Long warehouseId, String code) {
        Warehouse w = access.warehouse(warehouseId);
        Bin b = bins.findByCode(w.getId(), code.trim()).orElseThrow(() -> ApiException.notFound("No bin with code " + code + " in this warehouse"));
        List<BatchDto> list = batches.findForBin(b.getId()).stream().filter(s -> s.getQtyKg() > 0).map(Mapper::batch).toList();
        double qty = list.stream().mapToDouble(BatchDto::qtyKg).sum();
        return new BinDetailDto(b.getId(), b.getCode(), b.getRack().getCode(), b.getLevelNo(), b.getBayNo(), b.getCapacityKg(),
                Mapper.round(qty), b.getRack().getStorageType(), b.isBlocked(), list);
    }

    /** Checks a bin can take this material and quantity. Returns the bin. */
    public Bin checkTarget(Warehouse w, String binCode, Material m, double qtyKg, double alreadyPlannedKg) {
        Bin b = bins.findByCode(w.getId(), binCode.trim()).orElseThrow(() -> ApiException.badRequest("Bin " + binCode + " does not exist in " + w.getName()));
        if (b.isBlocked()) throw ApiException.badRequest("Bin " + b.getCode() + " is blocked");
        if (b.getRack().getStorageType() != m.getStorageType())
            throw ApiException.badRequest(m.getName() + " needs a " + m.getStorageType().name().toLowerCase() + " rack, but " + b.getCode() + " is " + b.getRack().getStorageType().name().toLowerCase());
        List<StockBatch> inBin = batches.findForBin(b.getId());
        double used = 0;
        for (StockBatch s : inBin) {
            if (s.getQtyKg() <= 0) continue;
            if (!s.getMaterial().getId().equals(m.getId()))
                throw ApiException.badRequest("Bin " + b.getCode() + " already holds " + s.getMaterial().getName());
            used += s.getQtyKg();
        }
        double free = b.getCapacityKg() - used - alreadyPlannedKg;
        if (qtyKg > free + 0.01)
            throw ApiException.badRequest("Bin " + b.getCode() + " has only " + Mapper.round(Math.max(0, free)) + " kg free");
        return b;
    }

    public StockTxn record(Warehouse w, TxnType type, Material m, String binCode, String batchNo, double qtyKg, String ref, String remarks) {
        StockTxn t = new StockTxn();
        t.setOrganization(w.getOrganization());
        t.setWarehouse(w);
        t.setType(type);
        t.setMaterial(m);
        t.setBinCode(binCode);
        t.setBatchNo(batchNo);
        t.setQtyKg(Mapper.round(qtyKg));
        t.setRefNo(ref);
        t.setUserName(Current.name());
        t.setRemarks(remarks);
        return txns.save(t);
    }

    public BatchDto transfer(TransferRequest r) {
        StockBatch src = batches.findForOrg(r.batchId(), Current.orgId()).orElseThrow(() -> ApiException.notFound("Batch not found"));
        if (r.qtyKg() > src.getQtyKg() + 0.01) throw ApiException.badRequest("Only " + Mapper.round(src.getQtyKg()) + " kg in this batch");
        Warehouse w = src.getWarehouse();
        Material m = src.getMaterial();
        if (src.getBin().getCode().equalsIgnoreCase(r.toBinCode().trim())) throw ApiException.badRequest("Source and target bin are the same");
        Bin target = checkTarget(w, r.toBinCode(), m, r.qtyKg(), 0);
        String ref = "TRF-" + System.currentTimeMillis() % 1_000_000;
        // Keep the original batch number and receipt date so FIFO stays correct.
        StockBatch dst = batches.findForBin(target.getId()).stream()
                .filter(s -> s.getBatchNo().equals(src.getBatchNo())).findFirst().orElse(null);
        if (dst == null) {
            dst = new StockBatch();
            dst.setOrganization(src.getOrganization());
            dst.setWarehouse(w);
            dst.setBin(target);
            dst.setMaterial(m);
            dst.setBatchNo(src.getBatchNo());
            dst.setReceivedAt(src.getReceivedAt());
            dst.setRefNo(src.getRefNo());
        }
        dst.setQtyKg(dst.getQtyKg() + r.qtyKg());
        batches.save(dst);
        src.setQtyKg(src.getQtyKg() - r.qtyKg());
        String fromCode = src.getBin().getCode();
        if (src.getQtyKg() <= 0.01) batches.delete(src);
        record(w, TxnType.TRANSFER_OUT, m, fromCode, src.getBatchNo(), r.qtyKg(), ref, r.remarks());
        record(w, TxnType.TRANSFER_IN, m, target.getCode(), src.getBatchNo(), r.qtyKg(), ref, r.remarks());
        batches.flush();
        return Mapper.batch(batches.findForOrg(dst.getId(), Current.orgId()).orElseThrow());
    }

    /** Stock count: set a batch to the counted quantity and log the difference. */
    public void adjust(AdjustRequest r) {
        StockBatch s = batches.findForOrg(r.batchId(), Current.orgId()).orElseThrow(() -> ApiException.notFound("Batch not found"));
        double diff = r.countedKg() - s.getQtyKg();
        if (Math.abs(diff) < 0.005) return;
        if (r.countedKg() > s.getBin().getCapacityKg()) throw ApiException.badRequest("Counted quantity is above the bin capacity");
        String ref = "CNT-" + LocalDate.now().toString().replace("-", "");
        record(s.getWarehouse(), TxnType.ADJUST, s.getMaterial(), s.getBin().getCode(), s.getBatchNo(), diff, ref,
                r.reason() == null || r.reason().isBlank() ? "Stock count" : r.reason());
        if (r.countedKg() <= 0.005) batches.delete(s);
        else s.setQtyKg(r.countedKg());
    }

    @Transactional(readOnly = true)
    public List<TxnDto> transactions(Long warehouseId, LocalDate from, LocalDate to, TxnType type) {
        LocalDateTime f = (from == null ? LocalDate.now().minusDays(30) : from).atStartOfDay();
        LocalDateTime t = (to == null ? LocalDate.now() : to).plusDays(1).atStartOfDay();
        List<StockTxn> list = warehouseId != null ? txns.findForWarehouse(access.warehouse(warehouseId).getId(), f, t)
                : txns.findForOrg(Current.orgId(), f, t);
        return list.stream().filter(x -> type == null || x.getType() == type).limit(5000).map(Mapper::txn).toList();
    }
}
