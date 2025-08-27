import { HourglassHigh, FastForward, ArrowClockwise } from "phosphor-react";

export const powerUpsConfig = [
  {
    name: "Extra Time",
    label: "+10s",
    description: "Add 10 extra seconds to the current question timer.",
    icon: <HourglassHigh size={22} weight="bold" />,
    price: 1, // in Pi
    limit: 2,
  },
  {
    name: "Skip Question",
    label: "Skip",
    description: "Skip this question and gain a point instantly.",
    icon: <FastForward size={22} weight="bold" />,
    price: 3, // in Pi
    limit: 1,
  },
  {
    name: "Second Chance",
    label: "Retry",
    description: "Get another try if you answer wrong.",
    icon: <ArrowClockwise size={22} weight="bold" />,
    price: 2, // in Pi
    limit: 1,
  },
];
