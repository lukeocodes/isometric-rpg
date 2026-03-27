import { registry } from "../registry";
import { WallN } from "./WallN";
import { WallS } from "./WallS";
import { WallW } from "./WallW";

registry.register(new WallN());
registry.register(new WallS());
registry.register(new WallW());
