package com.vollmoon.rackwise.service;

import com.vollmoon.rackwise.common.ApiException;
import com.vollmoon.rackwise.domain.*;
import com.vollmoon.rackwise.dto.Dtos.*;
import com.vollmoon.rackwise.repo.DispatchRepo;
import com.vollmoon.rackwise.repo.StockBatchRepo;
import com.vollmoon.rackwise.security.Current;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/** Outward flow: dispatch request, FIFO pick suggestion, pick confirmation. */
@Service
@Transactional
public class DispatchService {
    private final DispatchRepo dispatches;
    private final StockBatchRepo batches;
    private final StockService stock;
    private final AccessService access;

    public DispatchService(DispatchRepo dispatches, StockBatchRepo batches, StockService stock, AccessService access) {
        this.dispatches = dispatches;
        this.batches = batches;
        this.stock = stock;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public List<DispatchDto> list(Long warehouseId) {
        Warehouse w = access.warehouse(warehouseId);
        Map<Long, Double> avail = new HashMap<>();
        return dispatches.findForWarehouse(w.getId()).stream().map(d -> Mapper.dispatch(d,
                avail.computeIfAbsent(d.getMaterial().getId(), mid -> batches.sumQty(w.getId(), mid)))).toList();
    }

    public DispatchDto create(DispatchRequest r) {
        Warehouse w = access.warehouse(r.warehouseId());
        Material m = access.material(r.materialId());
        double available = batches.sumQty(w.getId(), m.getId());
        if (available + 0.01 < r.qtyKg())
            throw ApiException.badRequest("Only " + Mapper.round(available) + " kg of " + m.getName() + " is in stock in " + w.getName());
        Dispatch d = new Dispatch();
        d.setOrganization(w.getOrganization());
        d.setWarehouse(w);
        d.setMaterial(m);
        d.setQtyKg(r.qtyKg());
        d.setDestination(r.destination());
        d.setCustomerRef(r.customerRef());
        d.setRemarks(r.remarks());
        d.setCreatedByName(Current.name());
        d.setDspNo(ReceiptService.nextNo("DSP", dispatches.countByOrganizationId(w.getOrganization().getId())));
        return Mapper.dispatch(dispatches.save(d), available);
    }

    public DispatchDto cancel(Long id) {
        Dispatch d = get(id);
        if (d.getStatus() != DispatchStatus.PENDING) throw ApiException.badRequest("Only pending dispatches can be cancelled");
        d.setStatus(DispatchStatus.CANCELLED);
        return Mapper.dispatch(d, batches.sumQty(d.getWarehouse().getId(), d.getMaterial().getId()));
    }

    /** First in, first out: take from the oldest batches first. */
    @Transactional(readOnly = true)
    public PickSuggestionDto suggest(Long id) {
        Dispatch d = get(id);
        List<PickDto> picks = new ArrayList<>();
        double left = d.getQtyKg();
        for (StockBatch s : batches.findFifo(d.getWarehouse().getId(), d.getMaterial().getId())) {
            if (left <= 0.01) break;
            double q = Math.min(left, s.getQtyKg());
            Bin b = s.getBin();
            picks.add(new PickDto(s.getId(), b.getCode(), b.getRack().getCode(), b.getLevelNo(), b.getBayNo(), s.getBatchNo(),
                    s.getReceivedAt(), Mapper.round(s.getQtyKg()), Mapper.round(q)));
            left -= q;
        }
        return new PickSuggestionDto(picks, Mapper.round(Math.max(0, left)));
    }

    public DispatchDto confirm(Long id, ConfirmPickRequest req) {
        Dispatch d = get(id);
        if (d.getStatus() != DispatchStatus.PENDING) throw ApiException.badRequest("This dispatch is already " + d.getStatus().name().toLowerCase());
        List<PickLine> lines = req == null || req.picks() == null || req.picks().isEmpty()
                ? suggest(id).picks().stream().map(p -> new PickLine(p.batchId(), p.qtyKg())).toList()
                : req.picks();
        double total = lines.stream().mapToDouble(PickLine::qtyKg).sum();
        if (Math.abs(total - d.getQtyKg()) > 0.01)
            throw ApiException.badRequest("Picked " + Mapper.round(total) + " kg but the dispatch is " + Mapper.round(d.getQtyKg()) + " kg");
        for (PickLine line : lines) {
            StockBatch s = batches.findForOrg(line.batchId(), Current.orgId()).orElseThrow(() -> ApiException.badRequest("Batch no longer exists. Refresh the pick list."));
            if (!s.getWarehouse().getId().equals(d.getWarehouse().getId()) || !s.getMaterial().getId().equals(d.getMaterial().getId()))
                throw ApiException.badRequest("Batch " + s.getBatchNo() + " does not match this dispatch");
            if (line.qtyKg() > s.getQtyKg() + 0.01)
                throw ApiException.badRequest("Bin " + s.getBin().getCode() + " has only " + Mapper.round(s.getQtyKg()) + " kg of this batch");
            s.setQtyKg(s.getQtyKg() - line.qtyKg());
            stock.record(d.getWarehouse(), TxnType.OUT, d.getMaterial(), s.getBin().getCode(), s.getBatchNo(), line.qtyKg(), d.getDspNo(), d.getDestination());
            if (s.getQtyKg() <= 0.01) batches.delete(s);
        }
        d.setStatus(DispatchStatus.DISPATCHED);
        d.setDispatchedAt(LocalDateTime.now());
        batches.flush();
        return Mapper.dispatch(d, batches.sumQty(d.getWarehouse().getId(), d.getMaterial().getId()));
    }

    private Dispatch get(Long id) {
        return dispatches.findForOrg(id, Current.orgId()).orElseThrow(() -> ApiException.notFound("Dispatch not found"));
    }
}
