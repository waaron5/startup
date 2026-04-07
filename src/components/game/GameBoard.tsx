import { BUILDINGS } from "../../constants/buildings";
import { BOARD_LOCATION_LAYOUTS, BOARD_VIEW_BOX } from "../../constants/boardLayout";

type GameBoardProps = {
  clickableBuildingIds?: string[];
  spentBuildingIds?: string[];
  selectedBuildingId?: string | null;
  highlightedBuildingId?: string | null;
  disabled?: boolean;
  className?: string;
  onSelect?: (buildingId: string) => void;
};

function getBuildingStatus(options: {
  buildingId: string;
  clickableIds: Set<string>;
  spentIds: Set<string>;
  selectedBuildingId: string | null;
  highlightedBuildingId: string | null;
  disabled: boolean;
  onSelect?: (buildingId: string) => void;
}) {
  const {
    buildingId,
    clickableIds,
    spentIds,
    selectedBuildingId,
    highlightedBuildingId,
    disabled,
    onSelect,
  } = options;

  if (spentIds.has(buildingId)) {
    return "spent";
  }

  if (selectedBuildingId === buildingId) {
    return "selected";
  }

  if (highlightedBuildingId === buildingId) {
    return "highlighted";
  }

  if (!disabled && onSelect && clickableIds.has(buildingId)) {
    return "clickable";
  }

  return "idle";
}

function getBoardColors(status: string) {
  switch (status) {
    case "selected":
      return {
        fill: "#f2c97d",
        stroke: "#fff4d3",
        labelFill: "#f2c97d",
        labelStroke: "#fff4d3",
        labelText: "#0f2430",
        pulseFill: "#fff4d3",
        filter: "url(#board-selected-glow)",
        opacity: 1,
      };
    case "highlighted":
      return {
        fill: "#4aa8dc",
        stroke: "#d6f3ff",
        labelFill: "#1e6d95",
        labelStroke: "#8fd8ff",
        labelText: "#eef8ff",
        pulseFill: "#8fd8ff",
        filter: "url(#board-highlight-glow)",
        opacity: 1,
      };
    case "clickable":
      return {
        fill: "#2f6f90",
        stroke: "#9edcff",
        labelFill: "#18445b",
        labelStroke: "#6ec7ff",
        labelText: "#eef8ff",
        pulseFill: "#9edcff",
        filter: "url(#board-soft-glow)",
        opacity: 1,
      };
    case "spent":
      return {
        fill: "#193140",
        stroke: "#53697a",
        labelFill: "#173041",
        labelStroke: "#53697a",
        labelText: "#8ca2b2",
        pulseFill: "#53697a",
        filter: undefined,
        opacity: 0.82,
      };
    default:
      return {
        fill: "#2a4557",
        stroke: "#5c7c99",
        labelFill: "#183647",
        labelStroke: "#48657c",
        labelText: "#c9d8e2",
        pulseFill: "#5c7c99",
        filter: undefined,
        opacity: 0.92,
      };
  }
}

export default function GameBoard({
  clickableBuildingIds = [],
  spentBuildingIds = [],
  selectedBuildingId = null,
  highlightedBuildingId = null,
  disabled = false,
  className = "",
  onSelect,
}: GameBoardProps) {
  const clickableIds = new Set(clickableBuildingIds);
  const spentIds = new Set(spentBuildingIds);

  function handleActivate(buildingId: string) {
    if (disabled || !onSelect || !clickableIds.has(buildingId) || spentIds.has(buildingId)) {
      return;
    }

    onSelect(buildingId);
  }

  return (
    <div className={`card overflow-hidden p-3 ${className}`.trim()}>
      <svg
        aria-label="The Quisling game board"
        className="h-auto w-full"
        viewBox={BOARD_VIEW_BOX}
      >
        <defs>
          <linearGradient id="board-sky" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#24495d" />
            <stop offset="100%" stopColor="#102733" />
          </linearGradient>
          <linearGradient id="board-water" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#0d4b61" />
            <stop offset="100%" stopColor="#123c52" />
          </linearGradient>
          <pattern height="28" id="board-grid" patternUnits="userSpaceOnUse" width="28">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          </pattern>
          <filter height="180%" id="board-selected-glow" width="180%" x="-40%" y="-40%">
            <feDropShadow dx="0" dy="0" floodColor="#f2c97d" floodOpacity="0.65" stdDeviation="10" />
          </filter>
          <filter height="180%" id="board-highlight-glow" width="180%" x="-40%" y="-40%">
            <feDropShadow dx="0" dy="0" floodColor="#6ec7ff" floodOpacity="0.55" stdDeviation="9" />
          </filter>
          <filter height="180%" id="board-soft-glow" width="180%" x="-40%" y="-40%">
            <feDropShadow dx="0" dy="0" floodColor="#6ec7ff" floodOpacity="0.3" stdDeviation="7" />
          </filter>
        </defs>

        <rect fill="url(#board-sky)" height="720" rx="28" width="1000" />
        <rect fill="url(#board-grid)" height="720" opacity="0.55" rx="28" width="1000" />

        <path
          d="M0 560 C120 520 220 534 316 592 C392 638 494 658 610 644 C762 626 864 560 1000 562 V720 H0 Z"
          fill="url(#board-water)"
          opacity="0.95"
        />

        <g opacity="0.95">
          <path d="M66 110 H314 V282 H66 Z" fill="#1a3748" />
          <path d="M344 126 H642 V470 H344 Z" fill="#183444" />
          <path d="M662 108 H914 V328 H662 Z" fill="#1a3748" />
          <path d="M322 496 H636 V620 H322 Z" fill="#173140" />
          <path d="M76 472 H292 V618 H76 Z" fill="#143446" />
        </g>

        <g fill="none" opacity="0.65" stroke="#8db3c7" strokeLinecap="round">
          <path d="M318 102 L318 610" strokeWidth="16" />
          <path d="M640 94 L640 500" strokeWidth="16" />
          <path d="M96 296 L904 296" strokeWidth="16" />
          <path d="M144 470 L742 470" strokeWidth="14" />
          <path d="M198 168 L434 168" strokeWidth="10" />
          <path d="M436 470 L806 188" strokeWidth="10" />
        </g>

        <g fill="none" opacity="0.16" stroke="#f5fbff" strokeWidth="4">
          <path d="M108 88 H274 V326 H108 Z" />
          <path d="M356 96 H622 V488 H356 Z" />
          <path d="M676 88 H890 V340 H676 Z" />
          <path d="M90 486 H288 V632 H90 Z" />
        </g>

        {BUILDINGS.map((building) => {
          const layout = BOARD_LOCATION_LAYOUTS[building.id];

          if (!layout) {
            return null;
          }

          const status = getBuildingStatus({
            buildingId: building.id,
            clickableIds,
            spentIds,
            selectedBuildingId,
            highlightedBuildingId,
            disabled,
            onSelect,
          });
          const colors = getBoardColors(status);
          const isClickable = status === "clickable" || status === "selected";
          const labelRectX = layout.labelX - layout.labelWidth / 2;

          return (
            <g
              aria-disabled={!isClickable}
              aria-label={building.label}
              key={building.id}
              onClick={() => handleActivate(building.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleActivate(building.id);
                }
              }}
              role={isClickable ? "button" : undefined}
              style={{ cursor: isClickable ? "pointer" : "default" }}
              tabIndex={isClickable ? 0 : -1}
            >
              <path
                d={layout.footprintPath}
                fill={colors.fill}
                filter={colors.filter}
                opacity={colors.opacity}
                stroke={colors.stroke}
                strokeLinejoin="round"
                strokeWidth="6"
                vectorEffect="non-scaling-stroke"
              />

              {status === "spent" ? (
                <path
                  d={layout.footprintPath}
                  fill="none"
                  opacity="0.55"
                  stroke="#0c1b24"
                  strokeDasharray="14 10"
                  strokeLinecap="round"
                  strokeWidth="10"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}

              {status === "clickable" ? (
                <circle className="animate-pulse" cx={layout.labelX} cy={layout.labelY - 36} fill={colors.pulseFill} r="7" />
              ) : null}

              <rect
                fill={colors.labelFill}
                opacity={status === "spent" ? 0.92 : 1}
                rx="18"
                stroke={colors.labelStroke}
                strokeWidth="2"
                x={labelRectX}
                y={layout.labelY - 16}
                height="32"
                width={layout.labelWidth}
              />
              <text
                dominantBaseline="middle"
                fill={colors.labelText}
                fontSize="18"
                fontWeight="700"
                letterSpacing="0.08em"
                textAnchor="middle"
                x={layout.labelX}
                y={layout.labelY + 1}
              >
                {building.label.toUpperCase()}
              </text>

              <path
                d={layout.footprintPath}
                fill="transparent"
                stroke="transparent"
                strokeWidth="28"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
