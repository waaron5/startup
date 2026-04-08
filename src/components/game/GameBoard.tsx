import { BUILDINGS } from "../../constants/buildings";
import { BOARD_LOCATION_LAYOUTS, BOARD_VIEW_BOX } from "../../constants/boardLayout";
import mapBackground from "../../assets/images/map-background.png";

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
        fillOpacity: 0.45,
        stroke: "#fff4d3",
        strokeOpacity: 1,
        labelFill: "#f2c97d",
        labelStroke: "#fff4d3",
        labelText: "#0f2430",
        pulseFill: "#fff4d3",
        filter: "url(#board-selected-glow)",
      };
    case "highlighted":
      return {
        fill: "#4aa8dc",
        fillOpacity: 0.35,
        stroke: "#d6f3ff",
        strokeOpacity: 1,
        labelFill: "#1e6d95",
        labelStroke: "#8fd8ff",
        labelText: "#eef8ff",
        pulseFill: "#8fd8ff",
        filter: "url(#board-highlight-glow)",
      };
    case "clickable":
      return {
        fill: "#2f6f90",
        fillOpacity: 0.15,
        stroke: "#9edcff",
        strokeOpacity: 0.7,
        labelFill: "#18445b",
        labelStroke: "#6ec7ff",
        labelText: "#eef8ff",
        pulseFill: "#9edcff",
        filter: "url(#board-soft-glow)",
      };
    case "spent":
      return {
        fill: "#0c1b24",
        fillOpacity: 0.62,
        stroke: "#53697a",
        strokeOpacity: 0.7,
        labelFill: "#173041",
        labelStroke: "#53697a",
        labelText: "#8ca2b2",
        pulseFill: "#53697a",
        filter: undefined,
      };
    default:
      return {
        fill: "transparent",
        fillOpacity: 0,
        stroke: "#5c7c99",
        strokeOpacity: 0,
        labelFill: "#183647",
        labelStroke: "#48657c",
        labelText: "#c9d8e2",
        pulseFill: "#5c7c99",
        filter: undefined,
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
    <div className={`overflow-hidden ${className}`.trim()}>
      <svg
        aria-label="The Quisling game board"
        className="h-full w-full block"
        preserveAspectRatio="xMidYMin meet"
        viewBox={BOARD_VIEW_BOX}
      >
        <defs>
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

        <image height="720" href={mapBackground} width="1000" />

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
                fillOpacity={colors.fillOpacity}
                filter={colors.filter}
                stroke={colors.stroke}
                strokeOpacity={colors.strokeOpacity}
                strokeLinejoin="round"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />

              {status === "spent" ? (
                <path
                  d={layout.footprintPath}
                  fill="none"
                  opacity="0.4"
                  stroke="#0c1b24"
                  strokeDasharray="14 10"
                  strokeLinecap="round"
                  strokeWidth="6"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}

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
