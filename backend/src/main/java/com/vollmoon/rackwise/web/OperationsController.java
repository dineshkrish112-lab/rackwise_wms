package com.vollmoon.rackwise.web;

import com.vollmoon.rackwise.domain.TxnType;
import com.vollmoon.rackwise.dto.Dtos.*;
import com.vollmoon.rackwise.service.*;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/** Materials, stock, receipts, dispatch, transfers, stock count, dashboard and reports. */
@RestController
@RequestMapping("/api")
public class OperationsController {
    private final MaterialService materials;
    private final StockService stock;
    private final ReceiptService receipts;
    private final DispatchService dispatches;
    private final DashboardService dashboard;
    private final ReportService reports;

    public OperationsController(MaterialService materials, StockService stock, ReceiptService receipts, DispatchService dispatches,
                                DashboardService dashboard, ReportService reports) {
        this.materials = materials;
        this.stock = stock;
        this.receipts = receipts;
        this.dispatches = dispatches;
        this.dashboard = dashboard;
        this.reports = reports;
    }

    // ---------- materials ----------
    @GetMapping("/materials")
    @PreAuthorize(Perm.READ)
    public List<MaterialDto> materials() { return materials.list(); }

    @PostMapping("/materials")
    @PreAuthorize(Perm.MANAGE)
    public MaterialDto createMaterial(@Valid @RequestBody MaterialRequest r) { return materials.create(r); }

    @PutMapping("/materials/{id}")
    @PreAuthorize(Perm.MANAGE)
    public MaterialDto updateMaterial(@PathVariable Long id, @Valid @RequestBody MaterialRequest r) { return materials.update(id, r); }

    @DeleteMapping("/materials/{id}")
    @PreAuthorize(Perm.MANAGE)
    public void deleteMaterial(@PathVariable Long id) { materials.delete(id); }

    // ---------- stock ----------
    @GetMapping("/stock/batches")
    @PreAuthorize(Perm.READ)
    public List<BatchDto> batches(@RequestParam(required = false) Long warehouseId, @RequestParam(required = false) Long materialId,
                                  @RequestParam(required = false) String q) {
        return stock.batches(warehouseId, materialId, q);
    }

    @GetMapping("/stock/materials")
    @PreAuthorize(Perm.READ)
    public List<MaterialStockDto> materialStock(@RequestParam(required = false) Long warehouseId) { return stock.materialSummary(warehouseId); }

    @PostMapping("/stock/transfers")
    @PreAuthorize(Perm.OPERATE)
    public BatchDto transfer(@Valid @RequestBody TransferRequest r) { return stock.transfer(r); }

    @PostMapping("/stock/adjustments")
    @PreAuthorize(Perm.OPERATE)
    public void adjust(@Valid @RequestBody AdjustRequest r) { stock.adjust(r); }

    @GetMapping("/stock/transactions")
    @PreAuthorize(Perm.READ)
    public List<TxnDto> transactions(@RequestParam(required = false) Long warehouseId,
                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                     @RequestParam(required = false) TxnType type) {
        return stock.transactions(warehouseId, from, to, type);
    }

    // ---------- receipts (inward) ----------
    @GetMapping("/receipts")
    @PreAuthorize(Perm.READ)
    public List<ReceiptDto> receipts(@RequestParam Long warehouseId) { return receipts.list(warehouseId); }

    @PostMapping("/receipts")
    @PreAuthorize(Perm.OPERATE)
    public ReceiptDto createReceipt(@Valid @RequestBody ReceiptRequest r) { return receipts.create(r); }

    @GetMapping("/receipts/{id}/suggestion")
    @PreAuthorize(Perm.READ)
    public SuggestionDto suggestPutaway(@PathVariable Long id) { return receipts.suggest(id); }

    @PostMapping("/receipts/{id}/putaway")
    @PreAuthorize(Perm.OPERATE)
    public ReceiptDto putaway(@PathVariable Long id, @Valid @RequestBody PutawayRequest r) { return receipts.putaway(id, r); }

    @PostMapping("/receipts/{id}/cancel")
    @PreAuthorize(Perm.OPERATE)
    public ReceiptDto cancelReceipt(@PathVariable Long id) { return receipts.cancel(id); }

    // ---------- dispatch (outward) ----------
    @GetMapping("/dispatches")
    @PreAuthorize(Perm.READ)
    public List<DispatchDto> dispatches(@RequestParam Long warehouseId) { return dispatches.list(warehouseId); }

    @PostMapping("/dispatches")
    @PreAuthorize(Perm.OPERATE)
    public DispatchDto createDispatch(@Valid @RequestBody DispatchRequest r) { return dispatches.create(r); }

    @GetMapping("/dispatches/{id}/picks")
    @PreAuthorize(Perm.READ)
    public PickSuggestionDto picks(@PathVariable Long id) { return dispatches.suggest(id); }

    @PostMapping("/dispatches/{id}/confirm")
    @PreAuthorize(Perm.OPERATE)
    public DispatchDto confirm(@PathVariable Long id, @Valid @RequestBody(required = false) ConfirmPickRequest r) { return dispatches.confirm(id, r); }

    @PostMapping("/dispatches/{id}/cancel")
    @PreAuthorize(Perm.OPERATE)
    public DispatchDto cancelDispatch(@PathVariable Long id) { return dispatches.cancel(id); }

    // ---------- dashboard and reports ----------
    @GetMapping("/dashboard")
    @PreAuthorize(Perm.READ)
    public DashboardDto dashboard(@RequestParam(required = false) Long warehouseId) { return dashboard.get(warehouseId); }

    @GetMapping("/reports/movements")
    @PreAuthorize(Perm.READ)
    public MovementReportDto movements(@RequestParam(required = false) Long warehouseId,
                                       @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                       @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                       @RequestParam(required = false, defaultValue = "DAY") String groupBy) {
        return reports.movements(warehouseId, from, to, groupBy);
    }

    @GetMapping("/reports/stock")
    @PreAuthorize(Perm.READ)
    public StockReportDto stockReport(@RequestParam(required = false) Long warehouseId) { return reports.stock(warehouseId); }
}
