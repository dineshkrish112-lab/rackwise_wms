package com.vollmoon.rackwise.service;

import com.vollmoon.rackwise.domain.*;
import com.vollmoon.rackwise.dto.Dtos.*;
import com.vollmoon.rackwise.repo.*;
import com.vollmoon.rackwise.security.Current;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class DashboardService {
    private final WarehouseRepo warehouses;
    private final BinRepo bins;
    private final StockBatchRepo batches;
    private final StockTxnRepo txns;
    private final ReceiptRepo receipts;
    private final DispatchRepo dispatches;
    private final MaterialRepo materials;
    private final AccessService access;

    public DashboardService(WarehouseRepo warehouses, BinRepo bins, StockBatchRepo batches, StockTxnRepo txns, ReceiptRepo receipts,
                            DispatchRepo dispatches, MaterialRepo materials, AccessService access) {
        this.warehouses = warehouses;
        this.bins = bins;
        this.batches = batches;
        this.txns = txns;
        this.receipts = receipts;
        this.dispatches = dispatches;
        this.materials = materials;
        this.access = access;
    }

    public List<WarehouseSummaryDto> summaries() {
        Long org = Current.orgId();
        Map<Long, Double> cap = toMap(bins.capacityByWarehouse(org));
        Map<Long, Double> stk = toMap(batches.stockByWarehouse(org));
        return warehouses.findByOrganizationIdOrderByCodeAsc(org).stream().map(w -> {
            double c = cap.getOrDefault(w.getId(), 0.0), s = stk.getOrDefault(w.getId(), 0.0);
            return new WarehouseSummaryDto(w.getId(), w.getCode(), w.getName(), w.getLocation(), Mapper.round(s), Mapper.round(c),
                    c == 0 ? 0 : (int) Math.round(s / c * 100));
        }).toList();
    }

    public DashboardDto get(Long warehouseId) {
        List<WarehouseSummaryDto> sums = summaries();
        if (warehouseId == null) {
            if (sums.isEmpty()) return new DashboardDto(0, 0, 0, 0, 0, 0, 0, 0, List.of(), List.of(), sums);
            warehouseId = sums.get(0).id();
        }
        Warehouse w = access.warehouse(warehouseId);
        final Long wid = w.getId();
        WarehouseSummaryDto me = sums.stream().filter(s -> s.id().equals(wid)).findFirst().orElseThrow();
        List<StockTxn> today = txns.findForWarehouse(wid, LocalDate.now().atStartOfDay(), LocalDateTime.now().plusMinutes(1));
        Set<String> dispatchRefs = new HashSet<>();
        double outKg = 0, inKg = 0;
        for (StockTxn t : today) {
            if (t.getType() == TxnType.OUT) { outKg += t.getQtyKg(); dispatchRefs.add(t.getRefNo()); }
            if (t.getType() == TxnType.IN) inKg += t.getQtyKg();
        }
        Map<Long, Double> qtyByMat = new HashMap<>();
        for (StockBatch s : batches.findForWarehouse(wid)) qtyByMat.merge(s.getMaterial().getId(), s.getQtyKg(), Double::sum);
        List<LowStockDto> low = materials.findByOrganizationIdOrderByNameAsc(Current.orgId()).stream()
                .filter(m -> m.isActive() && m.getReorderLevelKg() > 0 && qtyByMat.getOrDefault(m.getId(), 0.0) < m.getReorderLevelKg())
                .map(m -> new LowStockDto(m.getId(), m.getName(), Mapper.round(qtyByMat.getOrDefault(m.getId(), 0.0)), m.getReorderLevelKg(), m.getUnit(), m.getUnitWeightKg()))
                .toList();
        List<TxnDto> recent = txns.recent(wid, PageRequest.of(0, 8)).stream().map(Mapper::txn).toList();
        return new DashboardDto(me.stockKg(), me.capacityKg(), me.utilisationPct(), dispatchRefs.size(), Mapper.round(outKg), Mapper.round(inKg),
                receipts.countByWarehouseIdAndStatus(wid, ReceiptStatus.PENDING), dispatches.countByWarehouseIdAndStatus(wid, DispatchStatus.PENDING),
                low, recent, sums);
    }

    private static Map<Long, Double> toMap(List<Object[]> rows) {
        Map<Long, Double> m = new HashMap<>();
        for (Object[] r : rows) m.put(((Number) r[0]).longValue(), r[1] == null ? 0 : ((Number) r[1]).doubleValue());
        return m;
    }
}
