package com.vollmoon.rackwise.service;

import com.vollmoon.rackwise.domain.*;
import com.vollmoon.rackwise.dto.Dtos.*;
import com.vollmoon.rackwise.repo.StockBatchRepo;
import com.vollmoon.rackwise.repo.StockTxnRepo;
import com.vollmoon.rackwise.security.Current;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

/** Daily, weekly and monthly movement analysis, plus stock analysis. */
@Service
@Transactional(readOnly = true)
public class ReportService {
    private final StockTxnRepo txns;
    private final StockBatchRepo batches;
    private final AccessService access;

    public ReportService(StockTxnRepo txns, StockBatchRepo batches, AccessService access) {
        this.txns = txns;
        this.batches = batches;
        this.access = access;
    }

    public MovementReportDto movements(Long warehouseId, LocalDate from, LocalDate to, String groupBy) {
        LocalDate f = from == null ? LocalDate.now().minusDays(29) : from;
        LocalDate t = to == null ? LocalDate.now() : to;
        String g = groupBy == null ? "DAY" : groupBy.toUpperCase();
        List<StockTxn> list = warehouseId != null
                ? txns.findForWarehouse(access.warehouse(warehouseId).getId(), f.atStartOfDay(), t.plusDays(1).atStartOfDay())
                : txns.findForOrg(Current.orgId(), f.atStartOfDay(), t.plusDays(1).atStartOfDay());

        // Build every period in range first so empty days still show on the chart.
        LinkedHashMap<String, double[]> buckets = new LinkedHashMap<>();
        Map<String, Set<String>> refs = new HashMap<>();
        Map<String, String> labels = new HashMap<>();
        for (LocalDate d = periodStart(f, g); !d.isAfter(t); d = next(d, g)) {
            String k = key(d, g);
            buckets.put(k, new double[2]);
            labels.put(k, label(d, g));
        }
        Map<String, Double> byMat = new HashMap<>(), byWh = new HashMap<>();
        double tin = 0, tout = 0;
        Set<String> allRefs = new HashSet<>();
        for (StockTxn x : list) {
            String k = key(periodStart(x.getCreatedAt().toLocalDate(), g), g);
            double[] b = buckets.get(k);
            if (b == null) continue;
            if (x.getType() == TxnType.IN) { b[0] += x.getQtyKg(); tin += x.getQtyKg(); }
            if (x.getType() == TxnType.OUT) {
                b[1] += x.getQtyKg();
                tout += x.getQtyKg();
                refs.computeIfAbsent(k, z -> new HashSet<>()).add(x.getRefNo());
                allRefs.add(x.getRefNo());
                byMat.merge(x.getMaterial().getName(), x.getQtyKg(), Double::sum);
                byWh.merge(x.getWarehouse().getName(), x.getQtyKg(), Double::sum);
            }
        }
        List<SeriesPoint> series = buckets.entrySet().stream().map(e -> new SeriesPoint(e.getKey(), labels.get(e.getKey()),
                Mapper.round(e.getValue()[0]), Mapper.round(e.getValue()[1]), refs.getOrDefault(e.getKey(), Set.of()).size())).toList();
        return new MovementReportDto(series, Mapper.round(tin), Mapper.round(tout), allRefs.size(), top(byMat, 8), top(byWh, 20));
    }

    public StockReportDto stock(Long warehouseId) {
        List<StockBatch> list = warehouseId != null ? batches.findForWarehouse(access.warehouse(warehouseId).getId())
                : batches.findForOrg(Current.orgId());
        Map<String, Double> byMat = new HashMap<>(), byWh = new HashMap<>(), byType = new HashMap<>();
        double[] aging = new double[4];
        double total = 0;
        LocalDateTime now = LocalDateTime.now();
        for (StockBatch s : list) {
            if (s.getQtyKg() <= 0) continue;
            total += s.getQtyKg();
            byMat.merge(s.getMaterial().getName(), s.getQtyKg(), Double::sum);
            byWh.merge(s.getWarehouse().getName(), s.getQtyKg(), Double::sum);
            byType.merge(s.getMaterial().getStorageType().name(), s.getQtyKg(), Double::sum);
            long days = Duration.between(s.getReceivedAt(), now).toDays();
            aging[days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3] += s.getQtyKg();
        }
        List<NameValue> agingList = List.of(new NameValue("0-30 days", Mapper.round(aging[0])), new NameValue("31-60 days", Mapper.round(aging[1])),
                new NameValue("61-90 days", Mapper.round(aging[2])), new NameValue("Over 90 days", Mapper.round(aging[3])));
        return new StockReportDto(Mapper.round(total), top(byMat, 50), top(byWh, 50), agingList, top(byType, 5));
    }

    private static List<NameValue> top(Map<String, Double> m, int n) {
        return m.entrySet().stream().sorted(Map.Entry.<String, Double>comparingByValue().reversed()).limit(n)
                .map(e -> new NameValue(e.getKey(), Mapper.round(e.getValue()))).collect(Collectors.toList());
    }

    private static LocalDate periodStart(LocalDate d, String g) {
        return switch (g) {
            case "WEEK" -> d.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case "MONTH" -> d.withDayOfMonth(1);
            default -> d;
        };
    }

    private static LocalDate next(LocalDate d, String g) {
        return switch (g) {
            case "WEEK" -> d.plusWeeks(1);
            case "MONTH" -> d.plusMonths(1);
            default -> d.plusDays(1);
        };
    }

    private static String key(LocalDate d, String g) {
        return g.equals("MONTH") ? d.format(DateTimeFormatter.ofPattern("yyyy-MM")) : d.toString();
    }

    private static String label(LocalDate d, String g) {
        return switch (g) {
            case "WEEK" -> "Wk " + d.format(DateTimeFormatter.ofPattern("dd MMM"));
            case "MONTH" -> d.format(DateTimeFormatter.ofPattern("MMM yyyy"));
            default -> d.format(DateTimeFormatter.ofPattern("dd MMM"));
        };
    }
}
