"use client";

import React, { useState } from "react";
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import CheckIcon from "@mui/icons-material/Check";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useLineSeries, useDrawingArea } from "@mui/x-charts/hooks";
import { useLedgerStore } from "@/store/useLedgerStore";
import { formatShortAxis } from "@/lib/money";

/**
 * Resolve per-chart value label visibility using the <= 31 points auto threshold + global/per-chart overrides (#1)
 */
export function useChartLabelVisibility(chartKey, pointCount = 0) {
  const analyticsGlobalLabelsMode = useLedgerStore((s) => s.analyticsGlobalLabelsMode);
  const chartLabelOverrides = useLedgerStore((s) => s.chartLabelOverrides);

  const override = chartLabelOverrides?.[chartKey];
  if (typeof override === "boolean") {
    return { showLabels: override, isOverridden: true, autoDefault: pointCount <= 31 };
  }

  if (analyticsGlobalLabelsMode === "SHOW") {
    return { showLabels: true, isOverridden: false, autoDefault: pointCount <= 31 };
  }
  if (analyticsGlobalLabelsMode === "HIDE") {
    return { showLabels: false, isOverridden: false, autoDefault: pointCount <= 31 };
  }

  return {
    showLabels: pointCount > 0 && pointCount <= 31,
    isOverridden: false,
    autoDefault: pointCount > 0 && pointCount <= 31,
  };
}

/**
 * Per-chart ⋮ menu button to toggle data points & compact value labels cleanly (#1)
 */
export function ChartCardHeaderMenu({ chartKey, pointCount = 0 }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const setChartLabelOverride = useLedgerStore((s) => s.setChartLabelOverride);
  const { showLabels, isOverridden, autoDefault } = useChartLabelVisibility(chartKey, pointCount);

  return (
    <>
      <IconButton
        size="small"
        aria-label="Chart display options"
        onClick={(e) => {
          e.stopPropagation();
          setAnchorEl(e.currentTarget);
        }}
      >
        <MoreVertIcon fontSize="small" sx={{ color: "#64748B" }} />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem
          onClick={() => {
            setChartLabelOverride(chartKey, !showLabels);
            setAnchorEl(null);
          }}
        >
          <ListItemIcon sx={{ minWidth: 28 }}>
            {showLabels ? <CheckIcon fontSize="small" color="primary" /> : null}
          </ListItemIcon>
          <ListItemText
            primary="Show Data Points & Value Labels"
            secondary={`Currently ${showLabels ? "ON" : "OFF"} (${pointCount} pts)`}
          />
        </MenuItem>

        {isOverridden && [
          <Divider key="div" />,
          <MenuItem
            key="reset"
            onClick={() => {
              setChartLabelOverride(chartKey, undefined);
              setAnchorEl(null);
            }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              <RestartAltIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={`Reset to Auto (${autoDefault ? "ON" : "OFF"} for ≤ 31 pts)`}
            />
          </MenuItem>,
        ]}
      </Menu>
    </>
  );
}

/**
 * Custom SVG LineChart mark component drawing circle points + compact value labels with white halo (#1)
 */
export function ChartDotLabelMark({
  seriesId,
  dataIndex,
  x,
  y,
  color,
  isHighlighted,
  isFaded,
  hidden,
  onClick,
  showLabels = false,
  isPrivacyHidden = false,
  skipSeriesIds = ["linear-trend"],
  labelStep = 1,
}) {
  const series = useLineSeries(seriesId);
  const drawingArea = useDrawingArea();

  if (hidden || x === undefined || y === undefined) return null;

  const isTrendSeries = skipSeriesIds?.includes(seriesId);
  const rawVal = series?.data?.[dataIndex];
  const shouldDrawText =
    showLabels &&
    !isPrivacyHidden &&
    !isTrendSeries &&
    rawVal !== null &&
    rawVal !== undefined &&
    (dataIndex % labelStep === 0 || isHighlighted);

  const labelY = y < (drawingArea?.top || 0) + 18 ? y + 15 : y - 9;

  return (
    <g onClick={onClick} style={{ cursor: onClick ? "pointer" : "default", opacity: isFaded ? 0.35 : 1 }}>
      <circle
        cx={x}
        cy={y}
        r={isHighlighted ? 5.5 : 3.8}
        fill="#FFFFFF"
        stroke={color || "#2563EB"}
        strokeWidth={isHighlighted ? 2.6 : 2}
      />
      {shouldDrawText && (
        <text
          x={x}
          y={labelY}
          textAnchor="middle"
          fill="#0F172A"
          fontSize={10}
          fontWeight={700}
          style={{
            paintOrder: "stroke",
            stroke: "#FFFFFF",
            strokeWidth: 3.2,
            strokeLinejoin: "round",
            pointerEvents: "none",
          }}
        >
          {formatShortAxis(rawVal)}
        </text>
      )}
    </g>
  );
}
