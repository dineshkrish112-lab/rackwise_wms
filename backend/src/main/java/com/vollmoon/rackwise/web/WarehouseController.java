package com.vollmoon.rackwise.web;

import com.vollmoon.rackwise.dto.Dtos.*;
import com.vollmoon.rackwise.service.StockService;
import com.vollmoon.rackwise.service.WarehouseService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/warehouses")
public class WarehouseController {
    private final WarehouseService warehouses;
    private final StockService stock;

    public WarehouseController(WarehouseService warehouses, StockService stock) {
        this.warehouses = warehouses;
        this.stock = stock;
    }

    @GetMapping
    @PreAuthorize(Perm.READ)
    public List<WarehouseDto> list() {
        return warehouses.list();
    }

    @PostMapping
    @PreAuthorize(Perm.MANAGE)
    public WarehouseDto create(@Valid @RequestBody WarehouseRequest r) {
        return warehouses.create(r);
    }

    @PutMapping("/{id}")
    @PreAuthorize(Perm.MANAGE)
    public WarehouseDto update(@PathVariable Long id, @Valid @RequestBody WarehouseRequest r) {
        return warehouses.update(id, r);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(Perm.ADMIN)
    public void delete(@PathVariable Long id) {
        warehouses.delete(id);
    }

    @GetMapping("/{id}/layout")
    @PreAuthorize(Perm.READ)
    public LayoutDto layout(@PathVariable Long id) {
        return warehouses.layout(id);
    }

    @GetMapping("/{id}/bins/{code}")
    @PreAuthorize(Perm.READ)
    public BinDetailDto bin(@PathVariable Long id, @PathVariable String code) {
        return stock.binDetail(id, code);
    }

    @PostMapping("/{id}/racks")
    @PreAuthorize(Perm.MANAGE)
    public RackDto createRack(@PathVariable Long id, @Valid @RequestBody RackRequest r) {
        return warehouses.createRack(id, r);
    }

    @PutMapping("/{id}/racks/{rackId}")
    @PreAuthorize(Perm.MANAGE)
    public RackDto updateRack(@PathVariable Long id, @PathVariable Long rackId, @Valid @RequestBody RackRequest r) {
        return warehouses.updateRack(id, rackId, r);
    }

    @DeleteMapping("/{id}/racks/{rackId}")
    @PreAuthorize(Perm.MANAGE)
    public void deleteRack(@PathVariable Long id, @PathVariable Long rackId) {
        warehouses.deleteRack(id, rackId);
    }
}
