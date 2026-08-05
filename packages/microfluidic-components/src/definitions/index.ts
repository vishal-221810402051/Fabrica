import { chamberDefinitions } from "./chambers";
import { channelDefinitions } from "./channels";
import { conditioningDefinitions } from "./conditioning";
import { genericDefinitions } from "./generic";
import { interfaceDefinitions } from "./interfaces";
import { junctionDefinitions } from "./junctions";
import { reservoirDefinitions } from "./reservoirs";
import { valveDefinitions } from "./valves";

export const builtInDefinitions = [
  ...channelDefinitions,
  ...junctionDefinitions,
  ...chamberDefinitions,
  ...reservoirDefinitions,
  ...valveDefinitions,
  ...conditioningDefinitions,
  ...interfaceDefinitions,
  ...genericDefinitions,
] as const;
