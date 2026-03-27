import { registry } from "../registry";
import { WallN } from "./WallN";
import { WallS } from "./WallS";

registry.register(new WallN());
registry.register(new WallS());
