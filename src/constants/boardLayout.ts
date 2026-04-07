export const BOARD_VIEW_BOX = "0 0 1000 720";

export type BoardLocationLayout = {
  footprintPath: string;
  labelX: number;
  labelY: number;
  labelWidth: number;
};

export const BOARD_LOCATION_LAYOUTS: Record<string, BoardLocationLayout> = {
  "bank-vault": {
    footprintPath:
      "M126 168 h134 a24 24 0 0 1 24 24 v70 a24 24 0 0 1 -24 24 h-134 a24 24 0 0 1 -24 -24 v-70 a24 24 0 0 1 24 -24 Z M152 194 h82 a10 10 0 0 1 10 10 v44 a10 10 0 0 1 -10 10 h-82 a10 10 0 0 1 -10 -10 v-44 a10 10 0 0 1 10 -10 Z",
    labelX: 193,
    labelY: 150,
    labelWidth: 164,
  },
  watchtower: {
    footprintPath:
      "M558 96 l36 26 v42 h18 a18 18 0 0 1 18 18 v34 a18 18 0 0 1 -18 18 h-108 a18 18 0 0 1 -18 -18 v-34 a18 18 0 0 1 18 -18 h18 v-42 l36 -26 Z",
    labelX: 558,
    labelY: 78,
    labelWidth: 164,
  },
  archives: {
    footprintPath:
      "M380 284 h130 l26 28 v102 a24 24 0 0 1 -24 24 h-158 a24 24 0 0 1 -24 -24 v-106 a24 24 0 0 1 24 -24 h26 Z M414 322 h38 v76 h-38 Z M470 322 h38 v76 h-38 Z",
    labelX: 434,
    labelY: 266,
    labelWidth: 152,
  },
  armory: {
    footprintPath:
      "M662 382 l42 -42 h92 l42 42 v74 l-42 42 h-92 l-42 -42 Z M704 382 h92 v116 h-92 Z",
    labelX: 750,
    labelY: 320,
    labelWidth: 132,
  },
  docks: {
    footprintPath:
      "M116 516 h158 a26 26 0 0 1 26 26 v64 a26 26 0 0 1 -26 26 h-158 a26 26 0 0 1 -26 -26 v-64 a26 26 0 0 1 26 -26 Z M148 606 v48 M188 606 v48 M228 606 v48 M268 606 v48",
    labelX: 193,
    labelY: 498,
    labelWidth: 112,
  },
  "radio-tower": {
    footprintPath:
      "M742 160 h42 l20 108 h-28 l-8 -52 h-10 l-8 52 h-28 Z M730 274 h66 a22 22 0 0 1 22 22 v14 a22 22 0 0 1 -22 22 h-66 a22 22 0 0 1 -22 -22 v-14 a22 22 0 0 1 22 -22 Z",
    labelX: 770,
    labelY: 142,
    labelWidth: 158,
  },
};
