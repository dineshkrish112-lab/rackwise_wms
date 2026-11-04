package com.vollmoon.rackwise.dto;

import com.vollmoon.rackwise.domain.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.LocalDateTime;
import java.util.List;

/** All request and response shapes for the REST API. */
public final class Dtos {
    private Dtos() {}

    // ---------- auth and accounts ----------
    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}
    public record LoginResponse(String token, MeDto me) {}
    public record ChangePasswordRequest(@NotBlank String currentPassword, @NotBlank @Size(min = 8) String newPassword) {}
    public record OrgDto(Long id, String name, String code, String tagline, String brandColor, String address,
                         String contactEmail, String plan, boolean active) {}
    public record UserDto(Long id, String fullName, String email, Role role, String phone, boolean active,
                          LocalDateTime lastLoginAt, LocalDateTime createdAt) {}
    public record MeDto(UserDto user, OrgDto organization) {}
    public record UserRequest(@NotBlank String fullName, @NotBlank @Email String email, @NotNull Role role,
                              String phone, Boolean active, String password) {}
    public record OrgUpdateRequest(@NotBlank String name, String tagline,
                                   @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "must be a hex colour like #d71920") String brandColor,
                                   String address, String contactEmail) {}
    public record OrgCreateRequest(@NotBlank String name, @NotBlank @Pattern(regexp = "^[A-Za-z0-9-]{2,40}$") String code,
                                   String brandColor, String plan, @NotBlank String adminName,
                                   @NotBlank @Email String adminEmail, @NotBlank @Size(min = 8) String adminPassword) {}
    public record OrgSummaryDto(OrgDto org, long users, long warehouses, LocalDateTime createdAt) {}

    // ---------- masters ----------
    public record WarehouseDto(Long id, String code, String name, String location, double widthM, double depthM,
                               double dockX, double dockZ, boolean active) {}
    public record WarehouseRequest(@NotBlank String code, @NotBlank String name, String location,
                                   @Positive Double widthM, @Positive Double depthM, Double dockX, Double dockZ, Boolean active) {}
    public record RackRequest(@NotBlank String code, @NotNull RackType rackType, @NotNull StorageType storageType,
                              @Min(1) @Max(40) int bays, @Min(1) @Max(12) int levels, @Positive double binCapacityKg,
                              double posX, double posZ, int rotation, String zoneCode, Long preferredMaterialId) {}
    public record MaterialDto(Long id, String code, String name, String category, StorageType storageType, UnitType unit,
                              double unitWeightKg, double reorderLevelKg, Visual visual, boolean active) {}
    public record MaterialRequest(@NotBlank String code, @NotBlank String name, String category, @NotNull StorageType storageType,
                                  @NotNull UnitType unit, @Positive double unitWeightKg, @PositiveOrZero double reorderLevelKg,
                                  @NotNull Visual visual, Boolean active) {}

    // ---------- layout for the 3D view ----------
    public record BinDto(Long id, String code, int levelNo, int bayNo, double capacityKg, double qtyKg, boolean blocked,
                         Long materialId, String materialName, Visual visual, UnitType unit, double unitWeightKg,
                         LocalDateTime oldestReceivedAt, int batchCount) {}
    public record RackDto(Long id, String code, RackType rackType, StorageType storageType, int bays, int levels,
                          double binCapacityKg, double posX, double posZ, int rotation, String zoneCode,
                          Long preferredMaterialId, String preferredMaterialName, List<BinDto> bins) {}
    public record LayoutDto(WarehouseDto warehouse, List<RackDto> racks) {}

    // ---------- stock ----------
    public record BatchDto(Long id, Long warehouseId, String warehouseCode, Long binId, String binCode, String rackCode,
                           Long materialId, String materialCode, String materialName, UnitType unit, double unitWeightKg,
                           String batchNo, double qtyKg, LocalDateTime receivedAt, String refNo, long ageDays) {}
    public record MaterialStockDto(Long materialId, String code, String name, String category, UnitType unit, double unitWeightKg,
                                   double qtyKg, int bins, LocalDateTime oldestReceivedAt, double reorderLevelKg, boolean low) {}
    public record BinDetailDto(Long id, String code, String rackCode, int levelNo, int bayNo, double capacityKg, double qtyKg,
                               StorageType storageType, boolean blocked, List<BatchDto> batches) {}
    public record TransferRequest(@NotNull Long batchId, @NotBlank String toBinCode, @Positive double qtyKg, String remarks) {}
    public record AdjustRequest(@NotNull Long batchId, @PositiveOrZero double countedKg, String reason) {}
    public record TxnDto(Long id, LocalDateTime at, TxnType type, Long warehouseId, String warehouseCode, Long materialId,
                         String materialName, String binCode, String batchNo, double qtyKg, String refNo, String userName, String remarks) {}

    // ---------- receipts and dispatch ----------
    public record ReceiptRequest(@NotNull Long warehouseId, @NotNull Long materialId, @Positive double qtyKg,
                                 String supplier, String invoiceNo, String vehicleNo, String remarks) {}
    public record ReceiptDto(Long id, Long warehouseId, String grnNo, Long materialId, String materialName, UnitType unit,
                             double unitWeightKg, double qtyKg, String supplier, String invoiceNo, String vehicleNo,
                             String remarks, ReceiptStatus status, String createdByName, LocalDateTime createdAt, LocalDateTime storedAt) {}
    public record AllocationDto(Long binId, String binCode, String rackCode, int levelNo, int bayNo, double qtyKg,
                                double freeKg, double distanceM, String reason) {}
    public record SuggestionDto(List<AllocationDto> allocations, double unallocatedKg) {}
    public record AllocLine(@NotBlank String binCode, @Positive double qtyKg) {}
    public record PutawayRequest(@NotEmpty List<@Valid AllocLine> allocations) {}

    public record DispatchRequest(@NotNull Long warehouseId, @NotNull Long materialId, @Positive double qtyKg,
                                  @NotBlank String destination, String customerRef, String remarks) {}
    public record DispatchDto(Long id, Long warehouseId, String dspNo, Long materialId, String materialName, UnitType unit,
                              double unitWeightKg, double qtyKg, String destination, String customerRef, String remarks,
                              DispatchStatus status, String createdByName, LocalDateTime createdAt, LocalDateTime dispatchedAt,
                              double availableKg) {}
    public record PickDto(Long batchId, String binCode, String rackCode, int levelNo, int bayNo, String batchNo,
                          LocalDateTime receivedAt, double availableKg, double qtyKg) {}
    public record PickSuggestionDto(List<PickDto> picks, double shortKg) {}
    public record PickLine(@NotNull Long batchId, @Positive double qtyKg) {}
    public record ConfirmPickRequest(List<@Valid PickLine> picks) {}

    // ---------- dashboard and reports ----------
    public record WarehouseSummaryDto(Long id, String code, String name, String location, double stockKg, double capacityKg, int utilisationPct) {}
    public record LowStockDto(Long materialId, String name, double qtyKg, double reorderLevelKg, UnitType unit, double unitWeightKg) {}
    public record DashboardDto(double stockKg, double capacityKg, int utilisationPct, long todayDispatchCount, double todayDispatchKg,
                               double todayReceiptKg, long pendingReceipts, long pendingDispatches, List<LowStockDto> lowStock,
                               List<TxnDto> recent, List<WarehouseSummaryDto> warehouses) {}
    public record SeriesPoint(String period, String label, double inKg, double outKg, long dispatchCount) {}
    public record NameValue(String name, double value) {}
    public record MovementReportDto(List<SeriesPoint> series, double totalInKg, double totalOutKg, long totalDispatches,
                                    List<NameValue> topMaterials, List<NameValue> byWarehouse) {}
    public record StockReportDto(double totalKg, List<NameValue> byMaterial, List<NameValue> byWarehouse, List<NameValue> aging,
                                 List<NameValue> byStorageType) {}
}
